import { Recording, DatabaseRecording } from '@/types';
import { storageService } from './storage';
import { supabaseService } from './supabase';
import { realtimeService } from './realtime';
import { pollingService } from './pollingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@secretary_recordings_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface RecordingCache {
  recordings: Recording[];
  timestamp: number;
}

type ChangeType = 'initial' | 'add' | 'update' | 'delete' | 'refresh';
type RecordingChangeListener = (recordings: Recording[], changeType: ChangeType, changedId?: string) => void;

class RecordingService {
  private cache: RecordingCache | null = null;
  private listeners: Set<RecordingChangeListener> = new Set();
  private realtimeUnsubscribe: (() => void) | null = null;
  private pollingUnsubscribe: (() => void) | null = null;
  private usePollingFallback = false;
  private hasInitialLoadCompleted = false;
  private isInitializing = false;

  async initialize(userId: string) {
    // Prevent double initialization in React Strict Mode
    if (this.isInitializing || this.hasInitialLoadCompleted) {
      console.log('RecordingService already initialized or initializing, skipping');
      return;
    }
    
    this.isInitializing = true;
    console.log('Starting RecordingService initialization');
    
    try {
      // Load initial data first
      const recordings = await this.loadRecordings();
      this.hasInitialLoadCompleted = true;
      // Ensure cache is set even for empty results
      if (!this.cache) {
        this.cache = {
          recordings: recordings,
          timestamp: Date.now()
        };
      }
      // Notify with initial data
      console.log(`Notifying initial load with ${this.cache.recordings.length} recordings`);
      this.notifyListeners('initial');
      
      // Try to initialize realtime service
      try {
        await realtimeService.initialize(userId);
        
        // Subscribe to recording changes
        this.realtimeUnsubscribe = realtimeService.onRecordingChange((recording) => {
          this.handleRecordingChange(recording);
        });

        // Monitor connection state
        realtimeService.onConnectionStateChange((connected) => {
          if (!connected && !this.usePollingFallback) {
            console.log('Realtime disconnected, starting polling fallback');
            this.startPollingFallback(userId);
          } else if (connected && this.usePollingFallback) {
            console.log('Realtime reconnected, stopping polling');
            this.stopPollingFallback();
          }
        });
      } catch (error) {
        console.warn('Realtime initialization failed, using polling fallback:', error);
        this.startPollingFallback(userId);
      }
    } finally {
      this.isInitializing = false;
      console.log('RecordingService initialization completed');
    }
  }

  private startPollingFallback(userId: string) {
    if (this.usePollingFallback) return;
    
    this.usePollingFallback = true;
    pollingService.initialize(userId);
    
    // Subscribe to polling updates
    this.pollingUnsubscribe = pollingService.onRecordingsChange((recordings) => {
      this.handlePollingUpdate(recordings);
    });
  }

  private stopPollingFallback() {
    if (!this.usePollingFallback) return;
    
    this.usePollingFallback = false;
    pollingService.stopPolling();
    
    if (this.pollingUnsubscribe) {
      this.pollingUnsubscribe();
      this.pollingUnsubscribe = null;
    }
  }

  private handlePollingUpdate(recordings: Recording[]) {
    // Update cache with all recordings from polling
    this.cache = {
      recordings,
      timestamp: Date.now()
    };
    
    this.saveCache();
    this.notifyListeners('refresh');
  }

  private async handleRecordingChange(recording: Recording & { _isDeleted?: boolean }) {
    // Initialize cache if it doesn't exist
    if (!this.cache) {
      this.cache = {
        recordings: [],
        timestamp: Date.now()
      };
    }

    // Create new immutable array instead of mutating existing
    let recordings = [...this.cache.recordings];
    const index = recordings.findIndex(r => r.id === recording.id);
    let changeType: ChangeType = 'update';
    
    // Handle deletion
    if (recording._isDeleted) {
      if (index >= 0) {
        recordings.splice(index, 1);
        console.log(`Deleted recording ${recording.id}`);
        changeType = 'delete';
      } else {
        console.log(`Recording ${recording.id} not found for deletion`);
        return; // Nothing to delete
      }
    } else if (index >= 0) {
      // Update existing recording - create new array
      recordings[index] = recording;
      console.log(`Updated recording ${recording.id} to state: ${recording.processingState}`);
      changeType = 'update';
    } else {
      // Add new recording - create new sorted array
      recordings.unshift(recording);
      recordings.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      console.log(`Added new recording ${recording.id} with state: ${recording.processingState}`);
      changeType = 'add';
    }

    // Update cache with new array reference
    this.cache = {
      recordings,
      timestamp: Date.now()
    };

    // Save to cache
    await this.saveCache();

    // Notify listeners with specific change
    console.log(`Notifying ${this.listeners.size} listeners of ${changeType} for ${recording.id}`);
    this.notifyListeners(changeType, recording.id);
  }

  private notifyListeners(changeType: ChangeType, changedId?: string) {
    if (this.cache) {
      // Always pass new array reference for React to detect changes
      this.listeners.forEach(listener => listener([...this.cache!.recordings], changeType, changedId));
    }
  }

  async loadRecordings(): Promise<Recording[]> {
    try {
      // Check cache first
      const cachedData = await this.loadCache();
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_EXPIRY) {
        this.cache = cachedData;
        return cachedData.recordings;
      }

      // Fetch from database
      const client = await supabaseService.getClient();
      const { data: { user } } = await client.auth.getUser();
      
      if (!user) {
        console.log('User not authenticated');
        // Set empty cache
        this.cache = {
          recordings: [],
          timestamp: Date.now()
        };
        return [];
      }

      const { data, error } = await client
        .from('recordings')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Failed to fetch recordings:', error);
        // Set cache with cached or empty data
        const recordings = cachedData?.recordings || [];
        this.cache = {
          recordings,
          timestamp: Date.now()
        };
        return recordings;
      }

      // Convert database records to Recording type
      const recordings = (data || []).map(record => this.databaseRecordingToRecording(record));

      // Update cache
      this.cache = {
        recordings,
        timestamp: Date.now()
      };
      await this.saveCache();

      return recordings;
    } catch (error) {
      console.error('Failed to load recordings:', error);
      // Try to return cached data
      const cachedData = await this.loadCache();
      return cachedData?.recordings || [];
    }
  }

  private databaseRecordingToRecording(dbRecord: DatabaseRecording): Recording {
    return {
      id: dbRecord.id,
      timestamp: new Date(dbRecord.timestamp),
      duration: dbRecord.duration,
      fileUri: dbRecord.audio_url || '',
      transcript: dbRecord.transcript,
      correctedTranscript: dbRecord.corrected_transcript,
      title: dbRecord.title,
      processingState: dbRecord.processing_state,
      processingStep: dbRecord.processing_step,
      processingError: dbRecord.processing_error,
      retryCount: dbRecord.retry_count,
      nextRetryAt: dbRecord.next_retry_at ? new Date(dbRecord.next_retry_at) : undefined,
      uploadProgress: dbRecord.upload_progress,
      transcriptionJobId: dbRecord.transcription_job_id,
      lastStateChangeAt: new Date(dbRecord.last_state_change_at),
      
      // Map to legacy fields for backward compatibility
      status: this.mapProcessingStateToStatus(dbRecord.processing_state),
      syncStatus: 'synced',
      error: dbRecord.processing_error?.message
    };
  }

  private mapProcessingStateToStatus(state: string): Recording['status'] {
    switch (state) {
      case 'recorded':
        return 'local';
      case 'uploading':
        return 'uploading';
      case 'uploaded':
      case 'transcribing':
      case 'transcribed':
      case 'webhook_sending':
      case 'webhook_sent':
      case 'completed':
        return 'uploaded';
      case 'upload_failed':
      case 'transcribe_failed':
      case 'webhook_failed':
        return 'failed';
      default:
        return 'local';
    }
  }

  async getRecordings(): Promise<Recording[]> {
    if (this.cache && Date.now() - this.cache.timestamp < CACHE_EXPIRY) {
      return this.cache.recordings;
    }
    return this.loadRecordings();
  }

  async getRecording(id: string): Promise<Recording | null> {
    const recordings = await this.getRecordings();
    return recordings.find(r => r.id === id) || null;
  }

  async deleteRecording(id: string): Promise<void> {
    try {
      const client = await supabaseService.getClient();
      const { data: { user } } = await client.auth.getUser();
      
      if (!user) throw new Error('User not authenticated');

      // Delete from database
      const { error } = await client
        .from('recordings')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Delete local file if exists
      const localRecordings = await storageService.getRecordings();
      const localRecording = localRecordings.find(r => r.id === id);
      if (localRecording) {
        await storageService.deleteRecording(id);
      }

      // Update cache
      if (this.cache) {
        this.cache.recordings = this.cache.recordings.filter(r => r.id !== id);
        await this.saveCache();
        this.notifyListeners('delete', id);
      }
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw error;
    }
  }

  async retryRecording(id: string): Promise<void> {
    const success = await realtimeService.retryRecording(id);
    if (success) {
      // The realtime subscription will automatically update the UI
      console.log(`Retry initiated for recording ${id}`);
    } else {
      throw new Error('Failed to retry recording');
    }
  }

  onRecordingsChange(callback: RecordingChangeListener): () => void {
    this.listeners.add(callback);
    
    // Immediately emit cached data if available and initialization completed
    if (this.cache && this.hasInitialLoadCompleted) {
      console.log(`Immediately providing ${this.cache.recordings.length} cached recordings to new listener`);
      callback([...this.cache.recordings], 'initial');
    }
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  private async loadCache(): Promise<RecordingCache | null> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEY);
      if (!data) return null;

      const cache = JSON.parse(data);
      // Convert date strings back to Date objects
      cache.recordings = cache.recordings.map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
        lastStateChangeAt: new Date(r.lastStateChangeAt),
        nextRetryAt: r.nextRetryAt ? new Date(r.nextRetryAt) : undefined
      }));

      return cache;
    } catch (error) {
      console.error('Failed to load cache:', error);
      return null;
    }
  }

  private async saveCache(): Promise<void> {
    if (!this.cache) return;

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  }

  async clearCache(): Promise<void> {
    this.cache = null;
    await AsyncStorage.removeItem(CACHE_KEY);
  }

  destroy() {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
    if (this.pollingUnsubscribe) {
      this.pollingUnsubscribe();
      this.pollingUnsubscribe = null;
    }
    this.listeners.clear();
    realtimeService.destroy();
    pollingService.destroy();
  }
}

export const recordingService = new RecordingService();