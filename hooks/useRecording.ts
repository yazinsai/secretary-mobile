import { useState, useEffect, useCallback } from 'react';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import Toast from 'react-native-toast-message';
import { audioService } from '@/services/audio';
import { Recording } from '@/types';
import { storageService } from '@/services/storage';
import { queueService } from '@/services/queue';
import { formatDuration } from '@/utils/helpers';

export function useRecording() {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRecordingState, setIsRecordingState] = useState(false);

  // Set the recorder in the audio service
  useEffect(() => {
    audioService.setRecorder(audioRecorder);
  }, [audioRecorder]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRecordingState) {
      const startTime = Date.now();
      interval = setInterval(() => {
        setDuration((Date.now() - startTime) / 1000);
      }, 100);
    } else {
      setDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecordingState]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      const recordingId = await audioService.startRecording();
      setCurrentRecordingId(recordingId);
      setIsRecordingState(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      setIsRecordingState(false);
      
      // Show error toast
      Toast.show({
        type: 'error',
        text1: 'Recording Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 4000,
      });
      
      console.error('Recording error:', err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!currentRecordingId) return;

    try {
      const result = await audioService.stopRecording();
      if (!result) {
        throw new Error('No recording to stop');
      }

      const recording: Recording = {
        id: currentRecordingId,
        timestamp: new Date(),
        duration: result.duration,
        fileUri: result.uri,
        status: 'local',
        retryCount: 0,
      };

      await storageService.saveRecording(recording);
      await queueService.enqueueRecording(recording);
      
      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Recording Saved',
        text2: `Duration: ${formatDuration(result.duration)}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      setCurrentRecordingId(null);
      setDuration(0);
      setIsRecordingState(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
      setIsRecordingState(false);
    }
  }, [currentRecordingId]);

  return {
    isRecording: isRecordingState,
    duration,
    error,
    startRecording,
    stopRecording,
  };
}