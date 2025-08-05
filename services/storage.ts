import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recording, Settings } from '@/types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/utils/constants';
import { v4 as uuidv4 } from 'uuid';

class StorageService {
  async getSettings(): Promise<Settings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) return DEFAULT_SETTINGS;
      
      const settings = JSON.parse(data);
      // Ensure dictionary exists for backward compatibility
      if (!settings.dictionary) {
        settings.dictionary = [];
      }
      
      return settings;
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
      
      // Check if migration is needed
      const needsMigration = recordings.some((r: any) => 
        r.id && !this.isValidUUID(r.id)
      );
      
      if (needsMigration) {
        await this.migrateRecordingIds(recordings);
        // Re-read the migrated data
        const migratedData = await AsyncStorage.getItem(STORAGE_KEYS.RECORDINGS);
        return JSON.parse(migratedData || '[]').map((r: any) => ({
          ...r,
          timestamp: new Date(r.timestamp),
          title: r.title || 'Untitled Recording',
          syncStatus: r.syncStatus || 'local',
          webhookLastSentAt: r.webhookLastSentAt ? new Date(r.webhookLastSentAt) : undefined,
        }));
      }
      
      return recordings.map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
        // Ensure new fields exist for backward compatibility
        title: r.title || 'Untitled Recording',
        syncStatus: r.syncStatus || 'local',
        webhookLastSentAt: r.webhookLastSentAt ? new Date(r.webhookLastSentAt) : undefined,
      }));
    } catch (error) {
      console.error('Failed to load recordings:', error);
      return [];
    }
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  private async migrateRecordingIds(recordings: any[]): Promise<void> {
    console.log('Migrating recording IDs to UUID format...');
    let migratedCount = 0;
    
    // Generate new UUIDs only for recordings that haven't been uploaded
    const migratedRecordings = recordings.map((r: any) => {
      if (!this.isValidUUID(r.id)) {
        // Check if recording has been uploaded to storage
        const isUploaded = r.status === 'uploaded' || 
                          (r.fileUri && typeof r.fileUri === 'string' && r.fileUri.startsWith('http'));
        
        if (isUploaded) {
          // Keep original ID for uploaded recordings to maintain storage reference
          console.log(`Keeping original ID for uploaded recording: ${r.id}`);
          return r;
        } else {
          // Generate new UUID for local recordings
          const newId = uuidv4();
          migratedCount++;
          console.log(`Migrating recording ${r.id} to ${newId}`);
          return { ...r, id: newId, syncStatus: 'local' };
        }
      }
      return r;
    });
    
    await AsyncStorage.setItem(
      STORAGE_KEYS.RECORDINGS,
      JSON.stringify(migratedRecordings)
    );
    
    console.log(`Migrated ${migratedCount} recording IDs to UUID format`);
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