import React from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { ThemedText } from './ThemedText';
import { IconSymbol } from './ui/IconSymbol';
import { ProcessingState, Recording } from '@/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/Colors';

interface ProcessingStateBadgeProps {
  recording: Recording;
  onRetry?: () => void;
}

export function ProcessingStateBadge({ recording, onRetry }: ProcessingStateBadgeProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const getStateDisplay = (state: ProcessingState): {
    label: string;
    icon: string;
    color: string;
    showProgress?: boolean;
    isError?: boolean;
  } => {
    switch (state) {
      case 'recorded':
        return { label: 'Queued', icon: 'clock', color: theme.textSecondary };
      case 'uploading':
        return { label: 'Uploading', icon: 'arrow.up.circle', color: theme.primary, showProgress: true };
      case 'uploaded':
        return { label: 'Uploaded', icon: 'checkmark.circle', color: theme.success };
      case 'transcribing':
        return { label: 'Transcribing', icon: 'waveform', color: theme.primary, showProgress: true };
      case 'transcribed':
        return { label: 'Transcribed', icon: 'text.bubble', color: theme.success };
      case 'webhook_sending':
        return { label: 'Sending', icon: 'paperplane', color: theme.primary, showProgress: true };
      case 'webhook_sent':
        return { label: 'Sent', icon: 'paperplane.fill', color: theme.success };
      case 'completed':
        return { label: 'Completed', icon: 'checkmark.circle.fill', color: theme.success };
      case 'upload_failed':
        return { label: 'Upload Failed', icon: 'exclamationmark.circle', color: theme.error, isError: true };
      case 'transcribe_failed':
        return { label: 'Transcription Failed', icon: 'exclamationmark.circle', color: theme.error, isError: true };
      case 'webhook_failed':
        return { label: 'Webhook Failed', icon: 'exclamationmark.circle', color: theme.error, isError: true };
      default:
        return { label: state, icon: 'questionmark.circle', color: theme.textSecondary };
    }
  };

  const stateInfo = getStateDisplay(recording.processingState);

  const pulseStyle = useAnimatedStyle(() => {
    if (!stateInfo.showProgress) return {};
    
    return {
      opacity: withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      ),
    };
  });

  // Don't show badge for completed recordings
  if (recording.processingState === 'completed') {
    return null;
  }

  return (
    <Animated.View 
      entering={FadeInDown}
      style={[
        styles.container,
        { backgroundColor: theme.backgroundSecondary }
      ]}
    >
      <View style={styles.content}>
        <Animated.View style={[styles.iconContainer, pulseStyle]}>
          <IconSymbol
            name={stateInfo.icon}
            size={14}
            color={stateInfo.color}
          />
        </Animated.View>
        
        <ThemedText style={[styles.label, { color: stateInfo.color }]}>
          {stateInfo.label}
        </ThemedText>

        {stateInfo.showProgress && recording.uploadProgress > 0 && recording.uploadProgress < 100 && (
          <ThemedText style={[styles.progress, { color: theme.textSecondary }]}>
            {recording.uploadProgress}%
          </ThemedText>
        )}

        {stateInfo.showProgress && !recording.uploadProgress && (
          <ActivityIndicator size="small" color={stateInfo.color} style={styles.spinner} />
        )}
      </View>

      {stateInfo.isError && onRetry && (
        <Pressable
          onPress={onRetry}
          style={[styles.retryButton, { backgroundColor: theme.error + '20' }]}
        >
          <IconSymbol name="arrow.clockwise" size={12} color={theme.error} />
          <ThemedText style={[styles.retryText, { color: theme.error }]}>
            Retry
          </ThemedText>
        </Pressable>
      )}

      {recording.processingError && (
        <View style={[styles.errorDetail, { backgroundColor: theme.error + '10' }]}>
          <ThemedText style={[styles.errorMessage, { color: theme.error }]}>
            {recording.processingError.message}
          </ThemedText>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  iconContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    textTransform: 'capitalize',
  },
  progress: {
    fontSize: Typography.sizes.xs,
    marginLeft: 'auto',
  },
  spinner: {
    marginLeft: 'auto',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  retryText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
  },
  errorDetail: {
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    padding: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  errorMessage: {
    fontSize: Typography.sizes.xs,
    lineHeight: Typography.sizes.xs * 1.4,
  },
});