import { Recording } from '@/types';
import * as Crypto from 'expo-crypto';

export function generateRecordingId(): string {
  return Crypto.randomUUID();
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

export function formatDateHeader(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateToCheck = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateToCheck.getTime() === today.getTime()) {
    return 'Today';
  } else if (dateToCheck.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else if (dateToCheck > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
    // Within last 7 days - show day name
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  } else {
    // Older than 7 days - show date
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: dateToCheck.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    }).format(date);
  }
}

export function formatTimeOnly(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

export function groupRecordingsByDate<T extends { timestamp: Date }>(recordings: T[]): { date: string; data: T[] }[] {
  const groups = new Map<string, T[]>();
  
  recordings.forEach(recording => {
    const dateKey = formatDateHeader(recording.timestamp);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(recording);
  });

  // Convert to array and maintain order
  const sortedDates = Array.from(groups.keys());
  const result = sortedDates.map(date => ({
    date,
    data: groups.get(date)!
  }));

  return result;
}