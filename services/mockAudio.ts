import { Platform } from 'react-native';
import * as Device from 'expo-device';

class MockAudioService {
  private mockRecordingId: string | null = null;
  private mockStartTime: number = 0;

  isSimulator(): boolean {
    return !Device.isDevice;
  }

  async startMockRecording(): Promise<string> {
    console.log('🎤 Mock Recording: Started (Simulator Mode)');
    this.mockStartTime = Date.now();
    this.mockRecordingId = `mock-${Date.now()}`;
    return this.mockRecordingId;
  }

  async stopMockRecording(): Promise<{ transcript: string; duration: number }> {
    const duration = Math.floor((Date.now() - this.mockStartTime) / 1000);
    console.log(`🎤 Mock Recording: Stopped after ${duration} seconds`);
    
    // Generate mock transcript based on duration
    const mockTranscripts = [
      "This is a test recording from the iOS Simulator.",
      "Remember to test on a real device for actual audio recording.",
      "The app is working correctly, but audio recording requires a physical device.",
      "Meeting notes: Discussed the quarterly goals and project timeline.",
      "Reminder to follow up with the team about the design review.",
    ];
    
    const transcript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
    
    this.mockRecordingId = null;
    this.mockStartTime = 0;
    
    return {
      transcript,
      duration,
    };
  }
}

export const mockAudioService = new MockAudioService();