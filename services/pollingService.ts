import { Recording, DatabaseRecording } from '@/types';
import { supabaseService } from './supabase';

type RecordingChangeHandler = (recordings: Recording[]) => void;

class PollingService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private handlers: Set<RecordingChangeHandler> = new Set();
  private lastFetch: Recording[] = [];
  private userId: string | null = null;
  private isPolling = false;

  async initialize(userId: string) {
    this.userId = userId;
    this.startPolling();
  }

  private startPolling() {
    if (this.pollingInterval) {
      return;
    }

    // Poll every 10 seconds
    this.pollingInterval = setInterval(() => {
      this.poll();
    }, 10000);

    // Delay initial poll to avoid conflicts with initial load
    setTimeout(() => {
      this.poll();
    }, 2000);
  }

  private async poll() {
    if (this.isPolling || !this.userId) {
      return;
    }

    this.isPolling = true;

    try {
      const client = await supabaseService.getClient();
      const { data: { user } } = await client.auth.getUser();
      
      if (!user) {
        console.log('User not authenticated, skipping poll');
        return;
      }

      const { data, error } = await client
        .from('recordings')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(50); // Get latest 50 recordings

      if (error) {
        console.error('Polling error:', error);
        return;
      }

      if (data) {
        const recordings = data.map(record => this.databaseRecordingToRecording(record));
        
        // Check if data has changed by comparing IDs and states
        const hasChanged = this.hasRecordingsChanged(recordings, this.lastFetch);
        
        if (hasChanged) {
          console.log('Polling detected changes, updating recordings');
          this.lastFetch = recordings;
          this.notifyHandlers(recordings);
        }
      }
    } catch (error) {
      console.error('Failed to poll recordings:', error);
    } finally {
      this.isPolling = false;
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

  private hasRecordingsChanged(newRecordings: Recording[], oldRecordings: Recording[]): boolean {
    if (newRecordings.length !== oldRecordings.length) {
      return true;
    }
    
    // Check if any recording has changed state or been modified
    for (const newRec of newRecordings) {
      const oldRec = oldRecordings.find(r => r.id === newRec.id);
      if (!oldRec) {
        return true; // New recording added
      }
      
      // Check if key fields have changed
      if (oldRec.processingState !== newRec.processingState ||
          oldRec.transcript !== newRec.transcript ||
          oldRec.title !== newRec.title ||
          oldRec.uploadProgress !== newRec.uploadProgress) {
        return true;
      }
    }
    
    return false;
  }

  private notifyHandlers(recordings: Recording[]) {
    this.handlers.forEach(handler => handler(recordings));
  }

  onRecordingsChange(handler: RecordingChangeHandler): () => void {
    this.handlers.add(handler);
    
    // Immediately call with current data if available
    if (this.lastFetch.length > 0) {
      handler(this.lastFetch);
    }

    // Return unsubscribe function
    return () => {
      this.handlers.delete(handler);
    };
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  destroy() {
    this.stopPolling();
    this.handlers.clear();
  }
}

export const pollingService = new PollingService();