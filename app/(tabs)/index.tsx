import { StyleSheet, View, Platform, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  interpolate,
  Easing,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Card } from '@/components/ui/Card';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/Colors';
import { useRecording } from '@/hooks/useRecording';
import { formatDuration } from '@/utils/helpers';
import { queueService } from '@/services/queue';
import { syncService } from '@/services/sync';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function RecordScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { isRecording, duration, error, startRecording, stopRecording } = useRecording();
  const [isSaving, setIsSaving] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  // Animation values
  const pulseScale = useSharedValue(1);
  const buttonScale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const gradientOpacity = useSharedValue(0.3);

  useEffect(() => {
    // Check queue count on mount and after recordings
    const checkQueue = async () => {
      const count = await queueService.getQueueCount();
      setQueueCount(count);
    };
    
    checkQueue();
    const interval = setInterval(checkQueue, 5000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isRecording) {
      // Start pulse animation
      pulseScale.value = withRepeat(
        withTiming(1.3, { duration: 1000, easing: Easing.ease }),
        -1,
        true
      );
      // Start rotation animation
      rotation.value = withRepeat(
        withTiming(360, { duration: 20000, easing: Easing.linear }),
        -1
      );
      // Increase gradient opacity
      gradientOpacity.value = withTiming(0.5, { duration: 300 });
    } else {
      // Stop animations
      pulseScale.value = withTiming(1, { duration: 300 });
      rotation.value = withTiming(0, { duration: 300 });
      gradientOpacity.value = withTiming(0.3, { duration: 300 });
    }
  }, [isRecording]);

  const handlePressIn = () => {
    'worklet';
    buttonScale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    'worklet';
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (isRecording) {
      setIsSaving(true);
      await stopRecording();
      setTimeout(() => setIsSaving(false), 500);
    } else {
      await startRecording();
    }
  };

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: interpolate(pulseScale.value, [1, 1.3], [0.3, 0]),
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const gradientAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: gradientOpacity.value,
  }));

  return (
    <ThemedView style={styles.container}>
      {/* Animated gradient background */}
      <AnimatedLinearGradient
        colors={[theme.primaryLight, theme.background, theme.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFillObject, gradientAnimatedStyle]}
      />

      {/* Queue badge */}
      {queueCount > 0 && (
        <Animated.View
          entering={SlideInRight.springify()}
          exiting={SlideOutRight.springify()}
          style={styles.queueBadge}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              syncService.syncRecordings();
            }}
          >
            <Card padding="md" shadow="sm" style={styles.queueCard}>
              <View style={styles.queueContent}>
                <IconSymbol name="arrow.up.circle.fill" size={20} color={theme.primary} />
                <ThemedText style={[styles.queueText, { color: theme.text }]}>
                  {queueCount} pending
                </ThemedText>
              </View>
            </Card>
          </Pressable>
        </Animated.View>
      )}

      {/* App title */}
      <Animated.View entering={FadeIn.delay(200)}>
        <ThemedText type="title" style={styles.title}>
          Secretary
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Your voice, captured beautifully
        </ThemedText>
      </Animated.View>

      {/* Record button container */}
      <View style={styles.recordContainer}>
        {/* Pulse effect when recording */}
        {isRecording && (
          <Animated.View
            style={[
              styles.pulseCircle,
              { backgroundColor: theme.primary },
              pulseAnimatedStyle,
            ]}
          />
        )}

        {/* Main record button */}
        <Animated.View style={buttonAnimatedStyle}>
          <Pressable
            style={[
              styles.recordButton,
              { 
                backgroundColor: isRecording ? theme.error : theme.primary,
              }
            ]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            disabled={isSaving}
          >
            <IconSymbol 
              size={64} 
              name={isRecording ? "stop.fill" : "mic.fill"} 
              color="white" 
            />
          </Pressable>
        </Animated.View>
      </View>

      {/* Status text */}
      <Animated.View entering={FadeIn.delay(400)}>
        <ThemedText style={styles.statusText}>
          {isSaving ? 'Saving...' : isRecording ? formatDuration(duration) : 'Tap to record'}
        </ThemedText>
      </Animated.View>

      {/* Error message */}
      {error && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={styles.errorContainer}
        >
          <Card padding="md" shadow="sm" style={styles.errorCard}>
            <ThemedText style={[styles.errorText, { color: theme.error }]}>
              {error}
            </ThemedText>
          </Card>
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  title: {
    fontSize: Typography.sizes.huge,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
    lineHeight: Typography.sizes.huge * 1.2,
  },
  subtitle: {
    fontSize: Typography.sizes.lg,
    opacity: 0.6,
    marginBottom: Spacing.huge,
    textAlign: 'center',
  },
  recordContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxxl,
  },
  recordButton: {
    width: 160,
    height: 160,
    borderRadius: BorderRadius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.xl,
  },
  pulseCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: BorderRadius.xxl,
  },
  statusText: {
    fontSize: Typography.sizes.xl,
    opacity: 0.8,
    fontWeight: Typography.weights.medium,
  },
  errorContainer: {
    position: 'absolute',
    bottom: Spacing.huge,
    left: Spacing.xl,
    right: Spacing.xl,
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    fontWeight: Typography.weights.medium,
  },
  queueBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: Spacing.xl,
  },
  queueCard: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  queueContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  queueText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
});