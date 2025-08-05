export interface Recording {
  id: string;
  timestamp: Date;
  duration: number;
  fileUri: string;
  transcript?: string;
  correctedTranscript?: string;
  title?: string;
  status: 'recording' | 'local' | 'queued' | 'uploading' | 'uploaded' | 'failed';
  syncStatus?: 'local' | 'syncing' | 'synced';
  retryCount: number;
  webhookStatus?: 'pending' | 'sent' | 'failed';
  webhookLastSentAt?: Date;
  error?: string;
}

export interface Settings {
  webhookUrl: string;
  groqApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey?: string; // Optional service role key for storage operations
  dictionary: string[];
}

export interface QueueItem {
  recordingId: string;
  addedAt: Date;
  retryCount: number;
  lastError?: string;
}

export interface WebhookPayload {
  id: string;
  timestamp: string;
  duration: number;
  transcript: string;
  correctedTranscript: string;
  audioUrl?: string;
  metadata?: Record<string, any>;
}