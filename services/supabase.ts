import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';
import { Recording, WebhookPayload } from '@/types';
import { userSettingsService } from './userSettings';
import { groqService } from './groq';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config/supabase.config';

class SupabaseService {
  private supabaseClient: SupabaseClient | null = null;
  private authClient: SupabaseClient | null = null;

  async getAuthClient() {
    if (!this.authClient) {
      this.authClient = createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            storage: {
              getItem: async (key: string) => {
                const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                return AsyncStorage.getItem(key);
              },
              setItem: async (key: string, value: string) => {
                const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                return AsyncStorage.setItem(key, value);
              },
              removeItem: async (key: string) => {
                const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                return AsyncStorage.removeItem(key);
              },
            },
          }
        }
      );
    }

    return this.authClient;
  }

  async getClient() {
    // For authenticated operations, use the auth client
    return this.getAuthClient();
  }

  async uploadAudio(recording: Recording): Promise<string> {
    try {
      const client = await this.getClient();
      
      // Get current user
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const fileName = `${user.id}/${recording.id}.m4a`;
      
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(recording.fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert base64 to buffer
      const fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      
      // Upload to Supabase Storage
      const { data, error } = await client.storage
        .from('recordings')
        .upload(fileName, fileData, {
          contentType: 'audio/mp4',
          upsert: true,
        });

      if (error) {
        if (error.message?.includes('Bucket not found')) {
          throw new Error('Supabase storage bucket "recordings" not found. Please create it in your Supabase dashboard.');
        } else if (error.message?.includes('row-level security policy')) {
          throw new Error('Supabase RLS policy blocking upload. Use service role key in settings or configure RLS policies.');
        } else if (error.message?.includes('Invalid API key') || error.message?.includes('JWT')) {
          throw new Error('Supabase authentication failed. Check your API keys in settings.');
        }
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = client.storage
        .from('recordings')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Failed to upload audio:', error);
      throw error;
    }
  }

  async uploadAndProcessRecording(recording: Recording): Promise<void> {
    try {
      const settings = await userSettingsService.getSettings();
      
      // Upload audio to Supabase
      const audioUrl = await this.uploadAudio(recording);
      
      // Transcribe and process with Groq
      const { transcript, correctedTranscript, title } = await groqService.transcribeAndProcess(recording.fileUri);
      
      // Update recording with transcript and title
      await storageService.updateRecording(recording.id, {
        transcript,
        correctedTranscript,
        title,
      });
      
      // Prepare webhook payload
      const webhookPayload: WebhookPayload = {
        id: recording.id,
        timestamp: recording.timestamp.toISOString(),
        duration: recording.duration,
        transcript,
        correctedTranscript: transcript,
        audioUrl,
      };
      
      // Send to webhook
      if (settings.webhookUrl) {
        await this.sendWebhook(settings.webhookUrl, webhookPayload);
      }
    } catch (error) {
      console.error('Failed to process recording:', error);
      throw error;
    }
  }

  async sendWebhook(url: string, payload: WebhookPayload): Promise<void> {
    try {
      // Call Supabase Edge Function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-webhook`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookUrl: url,
          payload,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Webhook failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send webhook:', error);
      throw error;
    }
  }

  async deleteRecording(recordingId: string): Promise<void> {
    try {
      const client = await this.getClient();
      
      // Get current user
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const fileName = `${user.id}/${recordingId}.m4a`;
      
      const { error } = await client.storage
        .from('recordings')
        .remove([fileName]);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete from Supabase:', error);
      // Non-critical error, continue
    }
  }
}

export const supabaseService = new SupabaseService();