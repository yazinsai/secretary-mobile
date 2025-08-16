import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/Colors';

interface RecordingTimerProps {
  isRecording: boolean;
  initialDuration: number;
}

export function RecordingTimer({ isRecording, initialDuration }: RecordingTimerProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [duration, setDuration] = useState(initialDuration);

  useEffect(() => {
    if (!isRecording) {
      setDuration(0);
      return;
    }

    setDuration(initialDuration);
    const interval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, initialDuration]);

  if (!isRecording) return null;

  return (
    <Animated.View 
      entering={FadeInDown}
      style={[styles.recordingOverlay, { backgroundColor: theme.overlay }]}
    >
      <View style={[styles.timerCard, { backgroundColor: theme.card }]}>
        <View style={styles.pulseIndicator}>
          <View style={[styles.pulseDot, { backgroundColor: theme.error }]} />
        </View>
        <Text style={[styles.timerText, { color: theme.text }]}>
          {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
        </Text>
        <Text style={[styles.recordingLabel, { color: theme.textSecondary }]}>
          Recording...
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  recordingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerCard: {
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.xxl,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  timerText: {
    fontSize: Typography.sizes.huge,
    lineHeight: Typography.sizes.huge * 1.2,
    fontWeight: Typography.weights.bold,
    marginTop: Spacing.lg,
  },
  recordingLabel: {
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.sm,
    letterSpacing: 0.5,
  },
  pulseIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});