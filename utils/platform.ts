import { Platform } from 'react-native';
import Constants from 'expo-constants';

export function isSimulator(): boolean {
  if (Platform.OS === 'ios') {
    // Check if running on iOS simulator
    return Constants.isDevice === false;
  } else if (Platform.OS === 'android') {
    // Check if running on Android emulator
    // Android emulators typically have specific device names/fingerprints
    return Constants.isDevice === false || 
           Constants.deviceName?.includes('emulator') || 
           Constants.deviceName?.includes('sdk') ||
           Constants.deviceName?.includes('Emulator') ||
           Constants.deviceName?.includes('SDK');
  }
  
  // For web or other platforms, assume it's not a simulator
  return false;
}

export function getSimulatorWarningMessage(): string {
  return 'Audio recording is not available on simulators/emulators. Please test on a physical device for full functionality.';
}