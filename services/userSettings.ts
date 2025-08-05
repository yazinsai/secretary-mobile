import { Settings } from '@/types';
import { supabaseService } from './supabase';
import { storageService } from './storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_SETTINGS_CACHE_KEY = '@secretary_user_settings_cache';

class UserSettingsService {
  private settingsCache: Settings | null = null;

  async getSettings(): Promise<Settings> {
    try {
      const client = await supabaseService.getAuthClient();
      const { data: { user } } = await client.auth.getUser();
      
      if (!user) {
        // Not authenticated, return settings from local storage
        return storageService.getSettings();
      }

      // Try cache first
      if (this.settingsCache) {
        return this.settingsCache;
      }

      // Fetch from Supabase
      const { data, error } = await client
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create it with defaults
          const defaultSettings = await this.migrateLocalSettings();
          return this.createUserProfile(user.id, defaultSettings);
        }
        throw error;
      }

      // Transform database fields to Settings type
      const settings: Settings = {
        webhookUrl: data.webhook_url || '',
        dictionary: data.dictionary || [],
      };

      // Cache the settings
      this.settingsCache = settings;
      await AsyncStorage.setItem(USER_SETTINGS_CACHE_KEY, JSON.stringify(settings));

      return settings;
    } catch (error) {
      console.error('Failed to get settings:', error);
      
      // Fallback to cached settings if available
      const cachedSettings = await AsyncStorage.getItem(USER_SETTINGS_CACHE_KEY);
      if (cachedSettings) {
        return JSON.parse(cachedSettings);
      }
      
      // Last resort: return default settings
      return {
        webhookUrl: '',
        dictionary: [],
      };
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    try {
      const client = await supabaseService.getAuthClient();
      const { data: { user } } = await client.auth.getUser();
      
      if (!user) {
        // Not authenticated, save to local storage
        return storageService.saveSettings(settings);
      }

      // Save user settings to Supabase
      const profileData = {
        webhook_url: settings.webhookUrl,
        dictionary: settings.dictionary,
        updated_at: new Date().toISOString(),
      };

      const { error } = await client
        .from('user_profiles')
        .upsert({
          id: user.id,
          ...profileData,
        });

      if (error) throw error;

      // Update cache
      this.settingsCache = settings;
      await AsyncStorage.setItem(USER_SETTINGS_CACHE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  private async createUserProfile(userId: string, settings: Settings): Promise<Settings> {
    try {
      const client = await supabaseService.getAuthClient();
      
      const profileData = {
        id: userId,
        webhook_url: settings.webhookUrl,
        dictionary: settings.dictionary,
      };

      const { error } = await client
        .from('user_profiles')
        .insert(profileData);

      if (error) throw error;

      // Cache the settings
      this.settingsCache = settings;
      await AsyncStorage.setItem(USER_SETTINGS_CACHE_KEY, JSON.stringify(settings));

      return settings;
    } catch (error) {
      console.error('Failed to create user profile:', error);
      throw error;
    }
  }

  private async migrateLocalSettings(): Promise<Settings> {
    try {
      // Get existing local settings
      const localSettings = await storageService.getSettings();
      
      // Clear local settings after migration
      await AsyncStorage.removeItem('@secretary_settings');
      
      return {
        webhookUrl: localSettings.webhookUrl,
        dictionary: localSettings.dictionary,
      };
    } catch (error) {
      console.error('Failed to migrate local settings:', error);
      return {
        webhookUrl: '',
        dictionary: [],
      };
    }
  }

  async clearCache(): Promise<void> {
    this.settingsCache = null;
    await AsyncStorage.removeItem(USER_SETTINGS_CACHE_KEY);
  }
}

export const userSettingsService = new UserSettingsService();