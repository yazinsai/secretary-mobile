import * as FileSystem from 'expo-file-system';
import { storageService } from './storage';

interface TranscriptionResult {
  transcript: string;
  correctedTranscript: string;
  title: string;
}

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

  async processTranscript(transcript: string): Promise<TranscriptionResult> {
    try {
      const settings = await storageService.getSettings();
      
      if (!settings.groqApiKey) {
        throw new Error('Groq API key not configured');
      }

      const dictionary = settings.dictionary || [];
      
      // Create prompt for title generation and correction
      const prompt = `Given this transcript, perform two tasks:

1. Generate a concise 3-5 word title that captures the main topic
2. Correct the transcript for proper capitalization and spelling of these dictionary terms: ${dictionary.join(', ')}

Transcript: "${transcript}"

Return JSON in this exact format:
{
  "title": "Generated Title Here",
  "corrected": "Corrected transcript here"
}`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that generates titles and corrects transcripts. Always return valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Processing failed: ${error}`);
      }

      const result = await response.json();
      const processed = JSON.parse(result.choices[0].message.content);

      return {
        transcript,
        correctedTranscript: processed.corrected || transcript,
        title: processed.title || 'Untitled Recording',
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