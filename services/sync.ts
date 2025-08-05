import NetInfo from '@react-native-community/netinfo';
import { Recording } from '@/types';
import { storageService } from './storage';
import { supabaseService } from './supabase';
import { userSettingsService } from './userSettings';

class SyncService {
  private isSyncing = false;
  private networkUnsubscribe: (() => void) | null = null;

  async initialize() {
    // Listen for network changes
    this.networkUnsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        this.syncRecordings();
      }
    });

    // Initial sync
    this.syncRecordings();
  }

  destroy() {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
  }

  async syncRecordings(): Promise<void> {
    if (this.isSyncing) return;

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) return;

    this.isSyncing = true;

    try {
      const recordings = await storageService.getRecordings();
      const unsyncedRecordings = recordings.filter(
        r => (r.syncStatus === 'local' || !r.syncStatus) && 
            (r.status === 'uploaded' || (r.status === 'local' && r.transcript))
      );

      for (const recording of unsyncedRecordings) {
        try {
          await this.syncRecording(recording);
        } catch (error) {
          console.error(`Failed to sync recording ${recording.id}:`, error);
          // Continue with other recordings
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncRecording(recording: Recording): Promise<void> {
    try {
      // Check if legacy recording needs processing
      if (recording.transcript && recording.title === 'Untitled Recording') {
        try {
          console.log(`Processing legacy recording ${recording.id} for title generation`);
          
          // Import groqService dynamically to avoid circular dependency
          const { groqService } = await import('./groq');
          
          // Get current user ID
          const client = await supabaseService.getClient();
          const { data: { user } } = await client.auth.getUser();
          
          // Process transcript to get title and corrections
          const processed = await groqService.processTranscript(recording.transcript, user?.id);
          
          // Update local recording with processed data
          await storageService.updateRecording(recording.id, {
            title: processed.title,
            correctedTranscript: processed.correctedTranscript
          });
          
          // Update recording object for sync
          recording.title = processed.title;
          recording.correctedTranscript = processed.correctedTranscript;
        } catch (error) {
          console.error(`Failed to process legacy recording ${recording.id}:`, error);
          // Continue with sync even if processing fails
        }
      }

      // Update sync status
      await storageService.updateRecording(recording.id, { syncStatus: 'syncing' });

      // Get Supabase client
      const client = await supabaseService.getClient();
      
      // Get current user
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Prepare data for database
      const dbRecord = {
        id: recording.id,
        user_id: user.id,
        timestamp: recording.timestamp.toISOString(),
        duration: Math.round(recording.duration),
        audio_url: recording.fileUri.startsWith('http') ? recording.fileUri : null,
        transcript: recording.transcript || null,
        corrected_transcript: recording.correctedTranscript || null,
        title: recording.title || 'Untitled Recording',
        status: recording.status,
        webhook_url: (await userSettingsService.getSettings()).webhookUrl,
        webhook_status: recording.webhookStatus || null,
        webhook_last_sent_at: recording.webhookLastSentAt?.toISOString() || null,
        error: recording.error || null,
        synced_at: new Date().toISOString(),
      };

      // Insert or update in database
      const { error } = await client
        .from('recordings')
        .upsert(dbRecord, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      // Update local sync status
      await storageService.updateRecording(recording.id, { syncStatus: 'synced' });
    } catch (error) {
      // Revert sync status on error
      await storageService.updateRecording(recording.id, { syncStatus: 'local' });
      throw error;
    }
  }

  async resendWebhook(recordingId: string): Promise<void> {
    try {
      const recordings = await storageService.getRecordings();
      const recording = recordings.find(r => r.id === recordingId);
      
      if (!recording) {
        throw new Error('Recording not found');
      }

      if (!recording.transcript) {
        throw new Error('No transcript available');
      }

      const settings = await userSettingsService.getSettings();
      if (!settings.webhookUrl) {
        throw new Error('No webhook URL configured');
      }

      // Send webhook
      await supabaseService.sendWebhook(settings.webhookUrl, {
        id: recording.id,
        timestamp: recording.timestamp.toISOString(),
        duration: recording.duration,
        transcript: recording.transcript,
        correctedTranscript: recording.correctedTranscript || recording.transcript,
        audioUrl: recording.fileUri.startsWith('http') ? recording.fileUri : undefined,
      });

      // Update webhook status
      await storageService.updateRecording(recordingId, {
        webhookStatus: 'sent',
        webhookLastSentAt: new Date(),
      });

      // Sync to database
      await this.syncRecordings();
    } catch (error) {
      await storageService.updateRecording(recordingId, {
        webhookStatus: 'failed',
        error: error instanceof Error ? error.message : 'Failed to resend webhook',
      });
      throw error;
    }
  }

  async resendAllFailedWebhooks(): Promise<{ successCount: number; failCount: number }> {
    const recordings = await storageService.getRecordings();
    const failedWebhooks = recordings.filter(r => r.webhookStatus === 'failed');

    let successCount = 0;
    let failCount = 0;

    for (const recording of failedWebhooks) {
      try {
        await this.resendWebhook(recording.id);
        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    return { successCount, failCount };
  }
}

export const syncService = new SyncService();