import * as FileSystem from 'expo-file-system';
import { userSettingsService } from './userSettings';
import { supabaseService } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config/supabase.config';

interface TranscriptionResult {
  transcript: string;
  correctedTranscript: string;
  title: string;
}

class GroqService {
  async transcribeAudio(fileUri: string): Promise<string> {
    try {

      // Read file as base64
      const base64Audio = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create form data
      const formData = new FormData();
      
      // Create a blob from base64
      const byteCharacters = atob(base64Audio);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mp4' });
      
      formData.append('file', blob, 'audio.m4a');

      // Call Supabase Edge Function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }

      const result = await response.json();
      return result.transcript || '';
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      throw error;
    }
  }

  async processTranscript(transcript: string): Promise<TranscriptionResult> {
    try {

      // Get current user ID
      const client = await supabaseService.getAuthClient();
      const { data: { user } } = await client.auth.getUser();

      // Call Supabase Edge Function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/process-transcript`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          userId: user?.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Processing failed');
      }

      const result = await response.json();

      return {
        transcript,
        correctedTranscript: result.correctedTranscript || transcript,
        title: result.title || 'Untitled Recording',
      };
    } catch (error) {
      console.error('Failed to process transcript:', error);
      // Return original transcript if processing fails
      return {
        transcript,
        correctedTranscript: transcript,
        title: 'Untitled Recording',
      };
    }
  }

  async transcribeAndProcess(fileUri: string): Promise<TranscriptionResult> {
    const transcript = await this.transcribeAudio(fileUri);
    return await this.processTranscript(transcript);
  }
}

export const groqService = new GroqService();