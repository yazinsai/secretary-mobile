import { useState, useRef } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { generateRecordingId } from '@/utils/helpers';
import { storageService } from '@/services/storage';
import { queueService } from '@/services/queue';
import { mockAudioService } from '@/services/mockAudio';
import { Recording } from '@/types';

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const startTime = useRef<number>(0);

  const startRecording = async () => {
    try {
      setError(null);
      
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Microphone permission denied');
        return;
      }

      // Configure audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording or mock recording for simulator
      if (mockAudioService.isSimulator()) {
        console.log('Starting mock recording on simulator');
        await mockAudioService.startMockRecording();
        setIsRecording(true);
        startTime.current = Date.now();
      } else {
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        
        recordingRef.current = recording;
        setIsRecording(true);
        startTime.current = Date.now();
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      const recordingDuration = Math.floor((Date.now() - startTime.current) / 1000);
      let recordingData: Recording;

      if (mockAudioService.isSimulator()) {
        console.log('Stopping mock recording on simulator');
        
        // Create a mock recording
        const mockFileUri = `${FileSystem.documentDirectory}recordings/mock_${Date.now()}.m4a`;
        
        recordingData = {
          id: generateRecordingId(),
          timestamp: new Date(),
          duration: recordingDuration,
          fileUri: mockFileUri,
          processingState: 'recorded',
          processingStep: 0,
          retryCount: 0,
          uploadProgress: 0,
          lastStateChangeAt: new Date(),
        };
      } else {
        if (!recordingRef.current) {
          throw new Error('No recording in progress');
        }

        // Stop the actual recording
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        
        if (!uri) {
          throw new Error('Failed to get recording URI');
        }

        // Get recording status for actual duration
        const status = await recordingRef.current.getStatusAsync();
        const actualDuration = Math.floor((status.durationMillis || 0) / 1000);

        // Move file to permanent location
        const fileName = `recording_${Date.now()}.m4a`;
        const newUri = `${FileSystem.documentDirectory}recordings/${fileName}`;
        
        // Ensure directory exists
        const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}recordings/`);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}recordings/`, { intermediates: true });
        }
        
        // Move the file
        await FileSystem.moveAsync({
          from: uri,
          to: newUri,
        });

        recordingData = {
          id: generateRecordingId(),
          timestamp: new Date(),
          duration: actualDuration,
          fileUri: newUri,
          processingState: 'recorded',
          processingStep: 0,
          retryCount: 0,
          uploadProgress: 0,
          lastStateChangeAt: new Date(),
        };
      }

      // Save to local storage
      await storageService.saveRecording(recordingData);
      
      // Add to processing queue
      await queueService.enqueueRecording(recordingData);

      // Reset state
      setIsRecording(false);
      recordingRef.current = null;
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError('Failed to save recording');
      setIsRecording(false);
      recordingRef.current = null;
    }
  };

  return {
    isRecording,
    error,
    startRecording,
    stopRecording,
  };
}