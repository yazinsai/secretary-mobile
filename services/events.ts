import { DeviceEventEmitter } from 'react-native';

export const EventTypes = {
  RECORDING_PROCESSED: 'RECORDING_PROCESSED',
  RECORDING_UPLOADED: 'RECORDING_UPLOADED',
  RECORDING_FAILED: 'RECORDING_FAILED',
  RECORDING_CREATED: 'RECORDING_CREATED',
  RECORDING_DELETED: 'RECORDING_DELETED',
} as const;

export type EventType = keyof typeof EventTypes;

class EventService {
  emit(event: EventType, data?: any) {
    DeviceEventEmitter.emit(event, data);
  }

  subscribe(event: EventType, callback: (data?: any) => void) {
    const subscription = DeviceEventEmitter.addListener(event, callback);
    return subscription;
  }

  unsubscribe(subscription: any) {
    subscription?.remove();
  }
}

export const eventService = new EventService();