import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { DatabaseRecording, Recording, ProcessingState } from '@/types';
import { supabaseService } from './supabase';

type RecordingChangeHandler = (recording: Recording) => void;
type ConnectionStateHandler = (connected: boolean) => void;

class RealtimeService {
  private channel: RealtimeChannel | null = null;
  private recordingHandlers: Set<RecordingChangeHandler> = new Set();
  private connectionHandlers: Set<ConnectionStateHandler> = new Set();
  private isConnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private userId: string | null = null;
  private isInitializing = false;

  async initialize(userId: string) {
    if (this.isInitializing || (this.userId === userId && this.channel)) {
      console.log('RealtimeService already initialized or initializing, skipping');
      return;
    }
    
    this.isInitializing = true;
    this.userId = userId;
    console.log('Starting RealtimeService initialization');
    
    try {
      // Wait longer and ensure session is fully ready for realtime
      await this.waitForAuthReady();
      
      await this.connect();
    } catch (error) {
      console.warn('Initial realtime connection failed, will retry in background:', error);
      // Don't throw - let the app continue working offline
    } finally {
      this.isInitializing = false;
      console.log('RealtimeService initialization completed');
    }
  }

  private async waitForAuthReady(): Promise<void> {
    const maxAttempts = 10;
    const delay = 500;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const client = await supabaseService.getClient();
        const { data: { session }, error } = await client.auth.getSession();
        
        if (session && session.access_token && !error) {
          console.log(`Auth session ready for realtime (attempt ${attempt})`);
          // Additional small delay to ensure session is fully propagated
          await new Promise(resolve => setTimeout(resolve, 1000));
          return;
        }
        
        console.log(`Waiting for auth session readiness (attempt ${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.warn(`Auth check attempt ${attempt} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.warn('Auth session may not be fully ready, proceeding anyway');
  }

  private async connect() {
    try {
      const client = await supabaseService.getClient();
      
      // Ensure we have a valid session before connecting
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError || !session) {
        throw new Error('No valid authentication session for realtime');
      }
      
      // Clean up existing connection
      if (this.channel) {
        try {
          await this.channel.unsubscribe();
          this.channel = null;
        } catch (error) {
          console.warn('Error unsubscribing from channel:', error);
        }
      }

      // Create channel with user-specific name
      const channelName = `recordings_${this.userId}`;
      console.log(`Creating realtime channel: ${channelName}`);
      
      this.channel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'recordings',
            filter: `user_id=eq.${this.userId}`
          },
          (payload: RealtimePostgresChangesPayload<DatabaseRecording>) => {
            console.log('Realtime INSERT received:', payload.new?.id);
            this.handleInsert(payload);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'recordings',
            filter: `user_id=eq.${this.userId}`
          },
          (payload: RealtimePostgresChangesPayload<DatabaseRecording>) => {
            console.log('Realtime UPDATE received:', payload.new?.id);
            this.handleUpdate(payload);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'recordings',
            filter: `user_id=eq.${this.userId}`
          },
          (payload: RealtimePostgresChangesPayload<DatabaseRecording>) => {
            console.log('Realtime DELETE received:', payload.old?.id);
            this.handleDelete(payload);
          }
        );

      // Subscribe to the channel and wait for it to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Subscription timeout'));
        }, 10000); // Reduced timeout to 10 seconds

        this.channel!.subscribe((status, error) => {
          console.log('Subscription status:', status, error ? `Error: ${error.message}` : '');
          
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeout);
            console.log('Successfully subscribed to realtime updates');
            this.setConnectionState(true);
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            clearTimeout(timeout);
            console.error('Channel error:', error);
            this.setConnectionState(false);
            reject(new Error(`Channel error: ${error?.message || 'Unknown'}`));
          } else if (status === 'CLOSED') {
            clearTimeout(timeout);
            console.warn('Subscription closed immediately - likely auth issue');
            this.setConnectionState(false);
            reject(new Error('Subscription closed - authentication or permission issue'));
          } else if (status === 'TIMED_OUT') {
            clearTimeout(timeout);
            console.warn('Subscription timed out');
            this.setConnectionState(false);
            reject(new Error('Subscription timed out'));
          }
          // For 'SUBSCRIBING' or other transient states, keep waiting
        });
      });
    } catch (error) {
      console.error('Failed to connect to realtime:', error);
      this.setConnectionState(false);
      this.scheduleReconnect();
    }
  }

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  private scheduleReconnect() {
    // Don't reconnect if already connected
    if (this.isConnected) {
      this.reconnectAttempts = 0;
      return;
    }
    
    // Stop trying after max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached, giving up on realtime');
      return;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Longer initial delay to give auth more time, then exponential backoff
    const baseDelay = this.reconnectAttempts === 0 ? 15000 : 10000; // 15s first, then 10s base
    const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), 160000);
    this.reconnectAttempts++;
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay/1000}s`);
    
    this.reconnectTimer = setTimeout(async () => {
      if (!this.isConnected && this.userId) {
        console.log(`Attempting to reconnect to realtime (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        // Wait for auth before reconnecting
        await this.waitForAuthReady();
        this.connect();
      }
    }, delay);
  }

  private setConnectionState(connected: boolean) {
    this.isConnected = connected;
    if (connected) {
      // Reset reconnection attempts on successful connection
      this.reconnectAttempts = 0;
    }
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  private handleInsert(payload: RealtimePostgresChangesPayload<DatabaseRecording>) {
    const newRecord = payload.new as DatabaseRecording;
    console.log('Handling INSERT:', newRecord?.id);

    const recording = this.databaseRecordingToRecording(newRecord);
    if (recording) {
      this.recordingHandlers.forEach(handler => handler(recording));
    }
  }

  private handleUpdate(payload: RealtimePostgresChangesPayload<DatabaseRecording>) {
    const newRecord = payload.new as DatabaseRecording;
    console.log('Handling UPDATE:', newRecord?.id);

    const recording = this.databaseRecordingToRecording(newRecord);
    if (recording) {
      this.recordingHandlers.forEach(handler => handler(recording));
    }
  }

  private handleDelete(payload: RealtimePostgresChangesPayload<DatabaseRecording>) {
    const oldRecord = payload.old as DatabaseRecording;
    console.log('Handling DELETE:', oldRecord?.id);

    if (oldRecord?.id) {
      // For deletions, create a minimal recording object with just the ID
      // The recordingService will handle removing it from the cache
      const deletedRecording: Recording & { _isDeleted: boolean } = {
        id: oldRecord.id,
        timestamp: new Date(),
        duration: 0,
        fileUri: '',
        processingState: 'recorded',
        processingStep: 0,
        retryCount: 0,
        uploadProgress: 0,
        lastStateChangeAt: new Date(),
        status: 'local',
        syncStatus: 'synced',
        _isDeleted: true // Special flag to indicate deletion
      };

      this.recordingHandlers.forEach(handler => handler(deletedRecording));
    }
  }

  private databaseRecordingToRecording(dbRecord?: DatabaseRecording): Recording | null {
    if (!dbRecord) return null;

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

  private mapProcessingStateToStatus(state: ProcessingState): Recording['status'] {
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

  // Public API
  onRecordingChange(handler: RecordingChangeHandler): () => void {
    this.recordingHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.recordingHandlers.delete(handler);
    };
  }

  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionHandlers.add(handler);
    
    // Immediately call with current state
    handler(this.isConnected);
    
    // Return unsubscribe function
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  async updateRecordingState(
    recordingId: string, 
    newState: ProcessingState,
    error?: { message: string; code?: string; details?: any },
    progress?: number
  ): Promise<boolean> {
    try {
      const client = await supabaseService.getClient();
      
      // Use the stored function for safe state transitions
      const { data, error: updateError } = await client.rpc('transition_processing_state', {
        p_recording_id: recordingId,
        p_new_state: newState,
        p_error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          timestamp: new Date().toISOString()
        } : null,
        p_progress: progress
      });

      if (updateError) {
        console.error('Failed to update recording state:', updateError);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error updating recording state:', error);
      return false;
    }
  }

  async retryRecording(recordingId: string): Promise<boolean> {
    try {
      const client = await supabaseService.getClient();
      
      // Get current state to determine where to retry from
      const { data: recording, error: fetchError } = await client
        .from('recordings')
        .select('processing_state')
        .eq('id', recordingId)
        .single();

      if (fetchError || !recording) {
        console.error('Failed to fetch recording for retry:', fetchError);
        return false;
      }

      // Determine the retry state based on current failed state
      let retryState: ProcessingState = 'recorded';
      switch (recording.processing_state) {
        case 'upload_failed':
          retryState = 'recorded'; // Start from beginning
          break;
        case 'transcribe_failed':
          retryState = 'uploaded'; // Retry transcription
          break;
        case 'webhook_failed':
          retryState = 'transcribed'; // Retry webhook
          break;
        default:
          console.warn('Recording is not in a failed state');
          return false;
      }

      // Reset to retry state
      const { error: updateError } = await client
        .from('recordings')
        .update({
          processing_state: retryState,
          processing_error: null,
          retry_count: 0,
          next_retry_at: null
        })
        .eq('id', recordingId);

      if (updateError) {
        console.error('Failed to reset recording for retry:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error retrying recording:', error);
      return false;
    }
  }

  destroy() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }

    this.recordingHandlers.clear();
    this.connectionHandlers.clear();
  }
}

export const realtimeService = new RealtimeService();