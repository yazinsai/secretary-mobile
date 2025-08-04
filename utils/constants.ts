export const STORAGE_KEYS = {
  SETTINGS: '@secretary_settings',
  RECORDINGS: '@secretary_recordings',
  QUEUE: '@secretary_queue',
} as const;

export const AUDIO_SETTINGS = {
  LOW: {
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  MEDIUM: {
    sampleRate: 24000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  HIGH: {
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 192000,
  },
} as const;

export const MAX_RETRY_COUNT = 3;
export const RETRY_DELAY = 1000; // Base delay in ms, will be exponential

export const DEFAULT_SETTINGS = {
  webhookUrl: '',
  groqApiKey: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseServiceKey: '',
};