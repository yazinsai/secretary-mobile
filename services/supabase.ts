import { createClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';
import { Recording, WebhookPayload } from '@/types';
import { storageService } from './storage';
import { groqService } from './groq';

class SupabaseService {
  private supabaseClient: any = null;

  async getClient() {
    if (!this.supabaseClient) {
      const settings = await storageService.getSettings();
      
      if (!settings.supabaseUrl || (!settings.supabaseAnonKey && !settings.supabaseServiceKey)) {
        throw new Error('Supabase configuration missing');
      }

      // Use service key if available (for storage operations without RLS)
      // Otherwise fall back to anon key
      const supabaseKey = settings.supabaseServiceKey || settings.supabaseAnonKey;

      this.supabaseClient = createClient(
        settings.supabaseUrl,
        supabaseKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          }
        }
      );
    }

    return this.supabaseClient;
  }

  async uploadAudio(recording: Recording): Promise<string> {
    try {
      const client = await this.getClient();
      const fileName = `${recording.id}.m4a`;
      
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
      const settings = await storageService.getSettings();
      
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
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send webhook:', error);
      throw error;
    }
  }

  async deleteRecording(recordingId: string): Promise<void> {
    try {
      const client = await this.getClient();
      const fileName = `${recordingId}.m4a`;
      
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