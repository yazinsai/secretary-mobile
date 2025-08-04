import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recording, Settings } from '@/types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/utils/constants';

class StorageService {
  async getSettings(): Promise<Settings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  async getRecordings(): Promise<Recording[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RECORDINGS);
      if (!data) return [];
      
      const recordings = JSON.parse(data);
      return recordings.map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      }));
    } catch (error) {
      console.error('Failed to load recordings:', error);
      return [];
    }
  }

  async saveRecording(recording: Recording): Promise<void> {
    try {
      const recordings = await this.getRecordings();
      recordings.unshift(recording);
      
      // Keep only last 100 recordings in local storage
      const recentRecordings = recordings.slice(0, 100);
      
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECORDINGS,
        JSON.stringify(recentRecordings)
      );
    } catch (error) {
      console.error('Failed to save recording:', error);
      throw error;
    }
  }

  async updateRecording(id: string, updates: Partial<Recording>): Promise<void> {
    try {
      const recordings = await this.getRecordings();
      const index = recordings.findIndex(r => r.id === id);
      
      if (index !== -1) {
        recordings[index] = { ...recordings[index], ...updates };
        await AsyncStorage.setItem(
          STORAGE_KEYS.RECORDINGS,
          JSON.stringify(recordings)
        );
      }
    } catch (error) {
      console.error('Failed to update recording:', error);
      throw error;
    }
  }

  async deleteRecording(id: string): Promise<void> {
    try {
      const recordings = await this.getRecordings();
      const filtered = recordings.filter(r => r.id !== id);
      
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECORDINGS,
        JSON.stringify(filtered)
      );
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw error;
    }
  }
}

export const storageService = new StorageService();