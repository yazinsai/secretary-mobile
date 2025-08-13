import { Recording } from '@/types';
import { storageService } from './storage';
import { supabaseService } from './supabase';

export interface MergedRecording extends Recording {
  source: 'local' | 'database' | 'both';
}

class RecordingService {
  async getMergedRecordings(): Promise<MergedRecording[]> {
    try {
      // Fetch from both sources in parallel
      const [localRecordings, databaseRecordings] = await Promise.all([
        storageService.getRecordings(),
        supabaseService.getRecordings()
      ]);
      
      console.log(`Fetched ${localRecordings.length} local recordings and ${databaseRecordings.length} database recordings`);

      // Create a map for efficient lookup
      const recordingMap = new Map<string, MergedRecording>();

      // Add all local recordings first
      for (const recording of localRecordings) {
        recordingMap.set(recording.id, {
          ...recording,
          source: 'local' as const
        });
      }

      // Process database recordings
      for (const dbRecording of databaseRecordings) {
        const existingRecording = recordingMap.get(dbRecording.id);
        
        if (existingRecording) {
          // Recording exists in both - prefer local version but mark as 'both'
          recordingMap.set(dbRecording.id, {
            ...existingRecording,
            source: 'both' as const,
            // Update sync status if it's synced in database
            syncStatus: 'synced' as const
          });
        } else {
          // Recording only exists in database
          recordingMap.set(dbRecording.id, {
            ...dbRecording,
            source: 'database' as const
          });
        }
      }

      // Convert map to array and sort by timestamp (newest first)
      const mergedRecordings = Array.from(recordingMap.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return mergedRecordings;
    } catch (error) {
      console.error('Failed to merge recordings:', error);
      // Fallback to local recordings only
      const localRecordings = await storageService.getRecordings();
      return localRecordings.map(r => ({
        ...r,
        source: 'local' as const
      }));
    }
  }

  async getRecording(id: string): Promise<MergedRecording | null> {
    try {
      // Fetch from both sources in parallel
      const [localRecordings, databaseRecordings] = await Promise.all([
        storageService.getRecordings(),
        supabaseService.getRecordings()
      ]);

      const localRecording = localRecordings.find(r => r.id === id);
      const dbRecording = databaseRecordings.find(r => r.id === id);
      
      if (localRecording && dbRecording) {
        // Recording exists in both
        return {
          ...localRecording,
          source: 'both' as const,
          syncStatus: 'synced' as const
        };
      } else if (localRecording) {
        // Only in local
        return {
          ...localRecording,
          source: 'local' as const
        };
      } else if (dbRecording) {
        // Only in database
        return {
          ...dbRecording,
          source: 'database' as const
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get recording:', error);
      return null;
    }
  }

  async deleteRecording(id: string): Promise<void> {
    const recording = await this.getRecording(id);
    if (!recording) {
      throw new Error('Recording not found');
    }

    try {
      // Delete from local storage if it exists locally
      if (recording.source === 'local' || recording.source === 'both') {
        await storageService.deleteRecording(id);
      }

      // Delete from Supabase if it exists there
      if (recording.source === 'database' || recording.source === 'both') {
        await supabaseService.deleteRecording(id);
      }
    } catch (error) {
      console.error('Error deleting recording:', error);
      throw error;
    }
  }
}

export const recordingService = new RecordingService();