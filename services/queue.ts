import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { Recording, ProcessingState, WebhookPayload, DatabaseRecording } from '@/types';
import { STORAGE_KEYS, MAX_RETRY_COUNT } from '@/utils/constants';
import { getExponentialBackoffDelay } from '@/utils/helpers';
import { storageService } from './storage';
import { supabaseService } from './supabase';
import { groqService } from './groq';
import { userSettingsService } from './userSettings';
import { mockAudioService } from './mockAudio';
import { realtimeService } from './realtime';
import * as FileSystem from 'expo-file-system';

interface QueueProcessor {
  recordingId: string;
  currentStep: ProcessingState;
}

class QueueService {
  private isProcessing = false;
  private networkUnsubscribe: (() => void) | null = null;
  private processingQueue: Map<string, QueueProcessor> = new Map();
  private processInterval: NodeJS.Timeout | null = null;

  async initialize() {
    // Listen for network changes
    this.networkUnsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        this.startProcessing();
      } else {
        this.stopProcessing();
      }
    });

    // Start processing if connected
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      this.startProcessing();
    }
  }

  private startProcessing() {
    if (this.processInterval) return;

    // Process queue every 5 seconds
    this.processInterval = setInterval(() => {
      this.processQueue();
    }, 5000);

    // Process immediately
    this.processQueue();
  }

  private stopProcessing() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  async enqueueRecording(recording: Recording): Promise<void> {
    try {
      // Always update local storage first (offline-first approach)
      await storageService.updateRecording(recording.id, {
        processingState: 'recorded',
        syncStatus: 'local' // Start as local, will become syncing when online
      });

      // Add to processing queue for when we're online
      this.processingQueue.set(recording.id, {
        recordingId: recording.id,
        currentStep: 'recorded'
      });

      // Check if online and create database record if possible
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        try {
          const client = await supabaseService.getClient();
          const { data: { user } } = await client.auth.getUser();
          
          if (user) {
            // Create database record with initial state
            const { error } = await client
              .from('recordings')
              .insert({
                id: recording.id,
                user_id: user.id,
                timestamp: recording.timestamp.toISOString(),
                duration: recording.duration,
                processing_state: 'recorded',
                processing_step: 0,
                retry_count: 0,
                upload_progress: 0,
                status: 'local', // Legacy field for backward compatibility
                webhook_status: null,
                error: null
              });

            if (!error) {
              // Successfully created in DB, update local status
              await storageService.updateRecording(recording.id, {
                syncStatus: 'syncing'
              });
              
              console.log(`Recording ${recording.id} queued and synced to database`);
              
              // Trigger immediate processing since we're online
              this.processQueue();
            } else {
              console.warn('Failed to create recording in database, will retry when online:', error);
            }
          }
        } catch (error) {
          console.warn('Failed to sync recording to database, will retry when online:', error);
        }
      } else {
        console.log(`Recording ${recording.id} queued locally, will sync when online`);
      }
    } catch (error) {
      console.error('Failed to enqueue recording locally:', error);
      throw error;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) return;

    this.isProcessing = true;

    try {
      const client = await supabaseService.getClient();
      const { data: { user } } = await client.auth.getUser();
      
      if (!user) {
        console.log('User not authenticated, skipping queue processing');
        return;
      }

      // First, sync any offline recordings to database
      await this.syncOfflineRecordings(user.id, client);

      // Get recordings that need processing
      const { data: recordings, error } = await client
        .from('recordings')
        .select('*')
        .eq('user_id', user.id)
        .in('processing_state', ['recorded', 'uploaded', 'transcribed', 'upload_failed', 'transcribe_failed', 'webhook_failed'])
        .lt('retry_count', MAX_RETRY_COUNT) // Don't process recordings that have exceeded max retries
        .or('next_retry_at.is.null,next_retry_at.lte.now()')
        .order('timestamp', { ascending: true })
        .limit(5);

      if (error) {
        console.error('Failed to fetch recordings for processing:', error);
        return;
      }

      // Process each recording
      for (const dbRecording of recordings || []) {
        await this.processRecording(dbRecording);
      }
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async syncOfflineRecordings(userId: string, client: any): Promise<void> {
    try {
      // Get all local recordings that haven't been synced
      const localRecordings = await storageService.getRecordings();
      const unsynced = localRecordings.filter(r => 
        r.syncStatus === 'local' && r.processingState === 'recorded'
      );

      for (const localRecording of unsynced) {
        try {
          // Check if it already exists in database
          const { data: existing } = await client
            .from('recordings')
            .select('id')
            .eq('id', localRecording.id)
            .single();

          if (!existing) {
            // Create new database record
            const { error } = await client
              .from('recordings')
              .insert({
                id: localRecording.id,
                user_id: userId,
                timestamp: localRecording.timestamp.toISOString(),
                duration: localRecording.duration,
                processing_state: 'recorded',
                processing_step: 0,
                retry_count: 0,
                upload_progress: 0,
                status: 'local',
                webhook_status: null,
                error: null
              });

            if (error) {
              console.warn(`Failed to sync offline recording ${localRecording.id}:`, error);
              continue;
            }
          }

          // Update local sync status
          await storageService.updateRecording(localRecording.id, {
            syncStatus: 'syncing'
          });

          console.log(`Synced offline recording ${localRecording.id} to database`);
        } catch (error) {
          console.warn(`Error syncing recording ${localRecording.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to sync offline recordings:', error);
    }
  }

  private async processRecording(dbRecording: DatabaseRecording): Promise<void> {
    try {
      // Determine next step based on current state
      switch (dbRecording.processing_state) {
        case 'recorded':
        case 'upload_failed':
          await this.uploadRecording(dbRecording);
          break;
          
        case 'uploaded':
        case 'transcribe_failed':
          await this.transcribeRecording(dbRecording);
          break;
          
        case 'transcribed':
        case 'webhook_failed':
          await this.sendWebhook(dbRecording);
          break;
          
        default:
          console.log(`Recording ${dbRecording.id} in state ${dbRecording.processing_state}, skipping`);
      }
    } catch (error) {
      console.error(`Failed to process recording ${dbRecording.id}:`, error);
    }
  }

  private async uploadRecording(dbRecording: DatabaseRecording): Promise<void> {
    try {
      // Skip if already has audio URL (already uploaded)
      if (dbRecording.audio_url) {
        console.log(`Recording ${dbRecording.id} already uploaded, moving to transcription`);
        await realtimeService.updateRecordingState(dbRecording.id, 'uploaded', undefined, 100);
        return;
      }

      await realtimeService.updateRecordingState(dbRecording.id, 'uploading', undefined, 0);

      // Get local recording file
      const localRecordings = await storageService.getRecordings();
      const localRecording = localRecordings.find(r => r.id === dbRecording.id);
      
      if (!localRecording || !localRecording.fileUri) {
        // If no local file but we have a transcript, mark as completed
        if (dbRecording.transcript) {
          console.log(`Recording ${dbRecording.id} has no local file but has transcript, marking as completed`);
          await realtimeService.updateRecordingState(dbRecording.id, 'completed');
          return;
        }
        throw new Error('Local recording file not found and no transcript available');
      }

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(localRecording.fileUri);
      if (!fileInfo.exists) {
        // If file doesn't exist but we have a transcript, mark as completed
        if (dbRecording.transcript) {
          console.log(`Recording ${dbRecording.id} file doesn't exist but has transcript, marking as completed`);
          await realtimeService.updateRecordingState(dbRecording.id, 'completed');
          return;
        }
        throw new Error('Recording file does not exist and no transcript available');
      }

      // Create a Recording object for upload
      const recordingForUpload: Recording = {
        ...localRecording,
        processingState: 'uploading',
        processingStep: 1,
        retryCount: dbRecording.retry_count,
        uploadProgress: 0,
        lastStateChangeAt: new Date()
      };

      // Upload to Supabase storage with progress tracking
      const audioUrl = await supabaseService.uploadAudio(recordingForUpload);

      // Update database with audio URL and state
      const client = await supabaseService.getClient();
      await client
        .from('recordings')
        .update({
          audio_url: audioUrl,
          processing_state: 'uploaded',
          upload_progress: 100
        })
        .eq('id', dbRecording.id);

      await realtimeService.updateRecordingState(dbRecording.id, 'uploaded', undefined, 100);

      console.log(`Successfully uploaded recording ${dbRecording.id}`);
    } catch (error) {
      console.error(`Failed to upload recording ${dbRecording.id}:`, error);
      
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown upload error',
        code: 'UPLOAD_ERROR'
      };

      await realtimeService.updateRecordingState(dbRecording.id, 'upload_failed', errorDetails);
      
      // Show error toast
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: errorDetails.message,
        position: 'top',
        visibilityTime: 4000,
      });
    }
  }

  private async transcribeRecording(dbRecording: DatabaseRecording): Promise<void> {
    try {
      await realtimeService.updateRecordingState(dbRecording.id, 'transcribing');

      // Get local recording for transcription
      const localRecordings = await storageService.getRecordings();
      const localRecording = localRecordings.find(r => r.id === dbRecording.id);
      
      let transcript: string;
      let correctedTranscript: string;
      let title: string;

      // Check if we're on simulator and use mock service
      if (mockAudioService.isSimulator() && localRecording?.fileUri.includes('ExpoAudio')) {
        console.log('Using mock audio service for simulator');
        const mockResult = await mockAudioService.stopMockRecording();
        transcript = mockResult.transcript;
        correctedTranscript = mockResult.transcript;
        title = 'Mock Recording (Simulator)';
      } else if (localRecording?.fileUri) {
        // Use Groq API for transcription
        const client = await supabaseService.getClient();
        const { data: { user } } = await client.auth.getUser();
        
        const result = await groqService.transcribeAndProcess(localRecording.fileUri, user?.id);
        transcript = result.transcript;
        correctedTranscript = result.correctedTranscript;
        title = result.title;
      } else if (dbRecording.audio_url) {
        // Download audio from URL and transcribe
        // This is a fallback for recordings that don't have local files
        throw new Error('Remote transcription not yet implemented');
      } else {
        throw new Error('No audio file available for transcription');
      }

      // Update database with transcription results
      const client = await supabaseService.getClient();
      await client
        .from('recordings')
        .update({
          transcript,
          corrected_transcript: correctedTranscript,
          title,
          processing_state: 'transcribed'
        })
        .eq('id', dbRecording.id);

      await realtimeService.updateRecordingState(dbRecording.id, 'transcribed');

      // Update local storage
      if (localRecording) {
        await storageService.updateRecording(dbRecording.id, {
          transcript,
          correctedTranscript,
          title
        });
      }

      console.log(`Successfully transcribed recording ${dbRecording.id}`);
    } catch (error) {
      console.error(`Failed to transcribe recording ${dbRecording.id}:`, error);
      
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown transcription error',
        code: 'TRANSCRIBE_ERROR'
      };

      await realtimeService.updateRecordingState(dbRecording.id, 'transcribe_failed', errorDetails);
      
      // Show error toast
      Toast.show({
        type: 'error',
        text1: 'Transcription Failed',
        text2: errorDetails.message,
        position: 'top',
        visibilityTime: 4000,
      });
    }
  }

  private async sendWebhook(dbRecording: DatabaseRecording): Promise<void> {
    try {
      const settings = await userSettingsService.getSettings();
      
      if (!settings.webhookUrl) {
        // No webhook configured, mark as completed
        await realtimeService.updateRecordingState(dbRecording.id, 'completed');
        return;
      }

      await realtimeService.updateRecordingState(dbRecording.id, 'webhook_sending');

      // Prepare webhook payload
      const webhookPayload: WebhookPayload = {
        id: dbRecording.id,
        timestamp: dbRecording.timestamp,
        duration: dbRecording.duration,
        transcript: dbRecording.transcript || '',
        correctedTranscript: dbRecording.corrected_transcript || dbRecording.transcript || '',
        audioUrl: dbRecording.audio_url,
      };

      // Send webhook
      await supabaseService.sendWebhook(settings.webhookUrl, webhookPayload);

      // Update database
      const client = await supabaseService.getClient();
      await client
        .from('recordings')
        .update({
          processing_state: 'completed',
          webhook_status: 'sent',
          webhook_last_sent_at: new Date().toISOString()
        })
        .eq('id', dbRecording.id);

      await realtimeService.updateRecordingState(dbRecording.id, 'completed');

      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Recording Processed',
        text2: 'Successfully sent to webhook',
        position: 'top',
        visibilityTime: 2000,
      });

      console.log(`Successfully sent webhook for recording ${dbRecording.id}`);
    } catch (error) {
      console.error(`Failed to send webhook for recording ${dbRecording.id}:`, error);
      
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown webhook error',
        code: 'WEBHOOK_ERROR'
      };

      await realtimeService.updateRecordingState(dbRecording.id, 'webhook_failed', errorDetails);
      
      // Show error toast
      Toast.show({
        type: 'error',
        text1: 'Webhook Failed',
        text2: errorDetails.message,
        position: 'top',
        visibilityTime: 4000,
      });
    }
  }

  destroy() {
    this.stopProcessing();
    
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
  }
}

export const queueService = new QueueService();