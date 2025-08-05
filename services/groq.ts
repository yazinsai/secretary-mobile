import * as FileSystem from 'expo-file-system';
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
      
      // For Edge Functions, we need to send the base64 data
      formData.append('file', base64Audio);
      formData.append('filename', 'audio.m4a');

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

  async processTranscript(transcript: string, userId?: string): Promise<TranscriptionResult> {
    try {
      // Call Supabase Edge Function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/process-transcript`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          userId,
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

  async transcribeAndProcess(fileUri: string, userId?: string): Promise<TranscriptionResult> {
    const transcript = await this.transcribeAudio(fileUri);
    return await this.processTranscript(transcript, userId);
  }
}

export const groqService = new GroqService();