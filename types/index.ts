export interface Recording {
  id: string;
  timestamp: Date;
  duration: number;
  fileUri: string;
  transcript?: string;
  correctedTranscript?: string;
  status: 'recording' | 'local' | 'queued' | 'uploading' | 'uploaded' | 'failed';
  retryCount: number;
  webhookStatus?: 'pending' | 'sent' | 'failed';
  error?: string;
}

export interface Settings {
  webhookUrl: string;
  groqApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey?: string; // Optional service role key for storage operations
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