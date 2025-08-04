import * as FileSystem from 'expo-file-system';
import { storageService } from './storage';

class GroqService {
  private baseUrl = 'https://api.groq.com/openai/v1';

  async transcribeAudio(fileUri: string): Promise<string> {
    try {
      const settings = await storageService.getSettings();
      
      if (!settings.groqApiKey) {
        throw new Error('Groq API key not configured');
      }

      // Read file as base64
      const base64Audio = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create form data
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: 'audio/mp4',
        name: 'audio.m4a',
      } as any);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'json');
      formData.append('language', 'en');

      // Send to Groq API
      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.groqApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Transcription failed: ${error}`);
      }

      const result = await response.json();
      return result.text || '';
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      throw error;
    }
  }
}

export const groqService = new GroqService();