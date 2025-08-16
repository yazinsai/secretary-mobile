export type ProcessingState = 
  | 'recorded'
  | 'uploading'
  | 'uploaded'
  | 'transcribing'
  | 'transcribed'
  | 'webhook_sending'
  | 'webhook_sent'
  | 'completed'
  | 'upload_failed'
  | 'transcribe_failed'
  | 'webhook_failed';

export interface ProcessingError {
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
}

export interface Recording {
  id: string;
  timestamp: Date;
  duration: number;
  fileUri: string;
  transcript?: string;
  correctedTranscript?: string;
  title?: string;
  
  // New processing state fields
  processingState: ProcessingState;
  processingStep: number;
  processingError?: ProcessingError;
  retryCount: number;
  nextRetryAt?: Date;
  uploadProgress: number;
  transcriptionJobId?: string;
  lastStateChangeAt: Date;
  
  // Legacy fields (to be phased out)
  status?: 'recording' | 'local' | 'queued' | 'uploading' | 'uploaded' | 'failed';
  syncStatus?: 'local' | 'syncing' | 'synced';
  webhookStatus?: 'pending' | 'sent' | 'failed';
  webhookLastSentAt?: Date;
  error?: string;
}

export interface Settings {
  webhookUrl: string;
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

// Database types for Supabase
export interface DatabaseRecording {
  id: string;
  user_id: string;
  timestamp: string;
  duration: number;
  audio_url?: string;
  transcript?: string;
  corrected_transcript?: string;
  title?: string;
  processing_state: ProcessingState;
  processing_step: number;
  processing_error?: ProcessingError;
  retry_count: number;
  next_retry_at?: string;
  upload_progress: number;
  transcription_job_id?: string;
  last_state_change_at: string;
  created_at: string;
  updated_at: string;
}

// Realtime event types
export interface RealtimeRecordingEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: DatabaseRecording;
  old?: DatabaseRecording;
}