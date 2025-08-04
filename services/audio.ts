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
        throw new Error('Microphone permission denied');
      }

      // Prepare and start recording
      await this.audioRecorder.prepareToRecordAsync();
      await this.audioRecorder.record();
      
      this.recordingStartTime = Date.now();
      const recordingId = generateRecordingId();
      
      return recordingId;
    } catch (error) {
      console.error('Failed to start recording:', error);
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