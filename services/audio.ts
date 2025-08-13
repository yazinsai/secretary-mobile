import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';  // For recording only
import * as FileSystem from 'expo-file-system';
import { Recording } from '@/types';
import { generateRecordingId } from '@/utils/helpers';

class AudioService {
  private audioRecorder: ReturnType<typeof useAudioRecorder> | null = null;
  private recordingStartTime: number = 0;
  private currentRecordingUri: string | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      console.log('Audio permission status:', status);
      
      if (!status.granted) {
        console.log('Microphone permission denied. Status:', status);
      }
      
      return status.granted;
    } catch (error) {
      console.error('Failed to request audio permissions:', error);
      return false;
    }
  }

  setRecorder(recorder: ReturnType<typeof useAudioRecorder>) {
    this.audioRecorder = recorder;
  }

  async startRecording(): Promise<string> {
    if (!this.audioRecorder) {
      throw new Error('Audio recorder not initialized');
    }

    try {
      // Request permissions first
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission denied. Please enable microphone access in Settings.');
      }

      console.log('Starting recording...');
      
      // Try to reset the recorder if it has a URI but isn't recording
      if (this.audioRecorder.uri && !this.audioRecorder.isRecording) {
        console.log('Resetting recorder state...');
        try {
          await this.audioRecorder.stop();
        } catch (e) {
          // Ignore errors when stopping a non-recording session
          console.log('Reset error (ignored):', e);
        }
      }
      
      // Prepare recording with options
      const prepared = await this.audioRecorder.prepareToRecordAsync({
        keepAudioActiveHint: true,
        android: {
          extension: '.m4a',
          outputFormat: 2, // MPEG_4
          audioEncoder: 3, // AAC
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: 127, // MAX
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });
      
      console.log('Prepared:', prepared);
      
      // Start recording
      await this.audioRecorder.record();
      
      // Wait a bit to let recording start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Recorder state after start:', {
        isRecording: this.audioRecorder.isRecording,
        uri: this.audioRecorder.uri
      });
      
      // On simulator, the recording might work even if isRecording is false
      // so we'll proceed if we have a URI
      
      console.log('Recording started successfully');
      
      this.recordingStartTime = Date.now();
      const recordingId = generateRecordingId();
      
      return recordingId;
    } catch (error) {
      console.error('Failed to start recording:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          throw new Error('Microphone permission required. Please enable it in Settings.');
        } else if (error.message.includes('simulator') || error.message.includes('recording state')) {
          throw new Error('Audio recording issue detected. On iOS Simulator, try using a real device for best results.');
        }
      }
      
      throw error;
    }
  }

  async stopRecording(): Promise<{ uri: string; duration: number } | null> {
    if (!this.audioRecorder) {
      return null;
    }

    try {
      const duration = Math.max((Date.now() - this.recordingStartTime) / 1000, 1);
      
      // Stop recording and get the result
      const result = await this.audioRecorder.stop();
      console.log('Recording stopped, result:', result);
      
      const uri = this.audioRecorder.uri;
      console.log('Recording URI:', uri);
      
      this.recordingStartTime = 0;

      if (!uri) {
        throw new Error('No recording URI available');
      }

      // Give the file system a moment to finalize the file
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify the file exists and has content
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('Final file info:', fileInfo);
      
      // On simulator, files might be smaller, so be more lenient
      if (!fileInfo.exists) {
        throw new Error('Recording file does not exist');
      }
      
      // Check if we're on iOS Simulator (file is exactly 28 bytes - empty m4a header)
      if (fileInfo.size === 28) {
        console.warn('iOS Simulator detected - audio recording not supported');
        throw new Error('Audio recording is not supported on iOS Simulator. Please use a real device or try the Android emulator.');
      }
      
      if (fileInfo.size < 100) {
        throw new Error(`Recording file is too small (${fileInfo.size} bytes). Try recording for longer.`);
      }

      this.currentRecordingUri = uri;
      return { uri, duration };
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.recordingStartTime = 0;
      throw error;
    }
  }

  async deleteRecording(uri: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(uri);
      }
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw error;
    }
  }

  isRecording(): boolean {
    return this.audioRecorder?.isRecording ?? false;
  }
}

export const audioService = new AudioService();