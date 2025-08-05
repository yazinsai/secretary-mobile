import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { Recording, QueueItem, WebhookPayload } from '@/types';
import { STORAGE_KEYS, MAX_RETRY_COUNT } from '@/utils/constants';
import { getExponentialBackoffDelay } from '@/utils/helpers';
import { storageService } from './storage';
import { supabaseService } from './supabase';
import { groqService } from './groq';
import { userSettingsService } from './userSettings';

class QueueService {
  private isProcessing = false;
  private networkUnsubscribe: (() => void) | null = null;

  async initialize() {
    // Listen for network changes
    this.networkUnsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        this.processQueue();
      }
    });

    // Process any existing queue items
    this.processQueue();
  }

  destroy() {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
  }

  async enqueueRecording(recording: Recording): Promise<void> {
    try {
      const queue = await this.getQueue();
      const queueItem: QueueItem = {
        recordingId: recording.id,
        addedAt: new Date(),
        retryCount: 0,
      };

      queue.push(queueItem);
      await AsyncStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
      
      await storageService.updateRecording(recording.id, { status: 'queued' });
      
      // Try to process immediately
      this.processQueue();
    } catch (error) {
      console.error('Failed to enqueue recording:', error);
      throw error;
    }
  }

  private async getQueue(): Promise<QueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.QUEUE);
      if (!data) return [];
      
      return JSON.parse(data).map((item: any) => ({
        ...item,
        addedAt: new Date(item.addedAt),
      }));
    } catch (error) {
      console.error('Failed to get queue:', error);
      return [];
    }
  }

  private async updateQueue(queue: QueueItem[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) return;

    this.isProcessing = true;

    try {
      const queue = await this.getQueue();
      const recordings = await storageService.getRecordings();
      
      for (const queueItem of queue) {
        const recording = recordings.find(r => r.id === queueItem.recordingId);
        if (!recording) continue;

        try {
          await storageService.updateRecording(recording.id, { status: 'uploading' });
          
          // Upload to Supabase and process
          // Get current user for Groq processing
          const client = await supabaseService.getAuthClient();
          const { data: { user } } = await client.auth.getUser();
          
          // Upload audio to Supabase
          const audioUrl = await supabaseService.uploadAudio(recording);
          
          // Transcribe and process with Groq
          const { transcript, correctedTranscript, title } = await groqService.transcribeAndProcess(recording.fileUri, user?.id);
          
          // Update recording with transcript and title
          await storageService.updateRecording(recording.id, {
            transcript,
            correctedTranscript,
            title,
          });
          
          // Get settings for webhook
          const settings = await userSettingsService.getSettings();
          
          // Prepare webhook payload
          const webhookPayload: WebhookPayload = {
            id: recording.id,
            timestamp: recording.timestamp.toISOString(),
            duration: recording.duration,
            transcript,
            correctedTranscript: correctedTranscript || transcript,
            audioUrl,
          };
          
          // Send to webhook
          if (settings.webhookUrl) {
            await supabaseService.sendWebhook(settings.webhookUrl, webhookPayload);
          }
          
          await storageService.updateRecording(recording.id, { 
            status: 'uploaded',
            webhookStatus: 'sent',
          });
          
          // Show success toast
          Toast.show({
            type: 'success',
            text1: 'Recording Uploaded',
            text2: 'Successfully sent to webhook',
            position: 'top',
            visibilityTime: 2000,
          });
          
          // Remove from queue
          const updatedQueue = queue.filter(item => item.recordingId !== recording.id);
          await this.updateQueue(updatedQueue);
        } catch (error) {
          console.error(`Failed to process recording ${recording.id}:`, error);
          
          queueItem.retryCount++;
          let errorMessage = 'Unknown error';
          
          if (error instanceof Error) {
            errorMessage = error.message;
            // Make error messages more user-friendly
            if (errorMessage.includes('Bucket not found')) {
              errorMessage = 'Supabase storage not configured. Please create "recordings" bucket.';
            } else if (errorMessage.includes('row-level security policy')) {
              errorMessage = 'Supabase RLS blocking uploads. Please disable RLS or add upload policy.';
            } else if (errorMessage.includes('Invalid API key')) {
              errorMessage = 'Invalid Groq API key. Please check your settings.';
            }
          }
          
          queueItem.lastError = errorMessage;
          
          if (queueItem.retryCount >= MAX_RETRY_COUNT) {
            await storageService.updateRecording(recording.id, { 
              status: 'failed',
              error: queueItem.lastError,
            });
            
            // Show error toast
            Toast.show({
              type: 'error',
              text1: 'Upload Failed',
              text2: errorMessage,
              position: 'top',
              visibilityTime: 4000,
            });
            
            // Remove from queue after max retries
            const updatedQueue = queue.filter(item => item.recordingId !== recording.id);
            await this.updateQueue(updatedQueue);
          } else {
            // Update retry count and wait before next attempt
            await storageService.updateRecording(recording.id, { status: 'queued' });
            await this.updateQueue(queue);
            
            // Wait with exponential backoff
            const delay = getExponentialBackoffDelay(queueItem.retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async getQueueCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }
}

export const queueService = new QueueService();