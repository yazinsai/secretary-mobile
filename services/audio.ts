import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';  // For recording only
import * as FileSystem from 'expo-file-system';
import { Recording } from '@/types';
import { generateRecordingId } from '@/utils/helpers';
import { isSimulator, getSimulatorWarningMessage } from '@/utils/platform';

class AudioService {
  private audioRecorder: ReturnType<typeof useAudioRecorder> | null = null;
  private recordingStartTime: number = 0;
  private currentRecordingUri: string | null = null;

  async requestPermissions(): Promise<boolean> {
    // Check if we're on a simulator first
    if (isSimulator()) {
      console.log('Running on simulator - audio recording not available');
      return false;
    }

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
    // Check for simulator first
    if (isSimulator()) {
      throw new Error(getSimulatorWarningMessage());
    }

    if (!this.audioRecorder) {
      throw new Error('Audio recorder not initialized');
    }

    try {
      // Request permissions first
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        if (isSimulator()) {
          throw new Error(getSimulatorWarningMessage());
        }
        throw new Error('Microphone permission denied. Please enable microphone access in Settings.');
      }

      console.log('Starting recording...');
      
      // Prepare and start recording
      await this.audioRecorder.prepareToRecordAsync();
      await this.audioRecorder.record();
      
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
        } else if (error.message.includes('simulator')) {
          throw new Error(getSimulatorWarningMessage());
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
      const duration = (Date.now() - this.recordingStartTime) / 1000;
      
      // Stop recording
      await this.audioRecorder.stop();
      const uri = this.audioRecorder.uri;
      
      this.recordingStartTime = 0;

      if (!uri) {
        throw new Error('No recording URI available');
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