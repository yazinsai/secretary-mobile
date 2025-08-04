import { Recording } from '@/types';

export function generateRecordingId(): string {
  return `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getExponentialBackoffDelay(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
}