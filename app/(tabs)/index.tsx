import { StyleSheet, View, Platform, Pressable, Dimensions } from 'react-native';
import { useState, useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  FadeIn,
  FadeOut,
  SlideInUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/Colors';
import { useRecording } from '@/hooks/useRecording';
import { isSimulator, getSimulatorWarningMessage } from '@/utils/platform';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Animated digit component with vertical slide
const AnimatedDigit = ({ value, style, color }: { value: string, style: any, color: string }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const [displayValue, setDisplayValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  useEffect(() => {
    if (value !== prevValue) {
      // Slide out old digit
      translateY.value = withSpring(-30, {
        damping: 8,
        stiffness: 200,
        velocity: 5,
      });
      opacity.value = withTiming(0, { duration: 150 });

      // Update value and slide in new digit
      setTimeout(() => {
        setDisplayValue(value);
        translateY.value = 30;
        translateY.value = withSpring(0, {
          damping: 10,
          stiffness: 180,
          mass: 0.8,
        });
        opacity.value = withTiming(1, { duration: 200 });
      }, 150);

      setPrevValue(value);
    }
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[style, animatedStyle, { color }]}>
      {displayValue}
    </Animated.Text>
  );
};

export default function RecordScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { isRecording, duration, error, startRecording, stopRecording } = useRecording();
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const isOnSimulator = isSimulator();

  // Animation values
  const buttonScale = useSharedValue(1);
  const timerContainerScale = useSharedValue(0);
  const timerContainerOpacity = useSharedValue(0);
  const successScale = useSharedValue(0);

  // Split duration into individual digits
  const formatDurationDigits = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const minStr = mins.toString();
    const secStr = secs.toString().padStart(2, '0');
    
    return {
      minutes: minStr,
      secondTens: secStr[0],
      secondOnes: secStr[1],
    };
  };

  const { minutes, secondTens, secondOnes } = formatDurationDigits(duration);

  useEffect(() => {
    if (isRecording) {
      // Animate timer container in with smooth scale
      timerContainerOpacity.value = withTiming(1, { duration: 300 });
      timerContainerScale.value = withSpring(1, {
        damping: 12,
        stiffness: 150,
      });
    } else {
      // Hide timer when not recording
      timerContainerOpacity.value = withTiming(0, { duration: 200 });
      timerContainerScale.value = withTiming(0.8, { duration: 200 });
    }
  }, [isRecording]);

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.88, { 
      damping: 10, 
      stiffness: 400 
    });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { 
      damping: 8,
      stiffness: 200,
      velocity: 2
    });
  };

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (isRecording) {
      setIsSaving(true);
      await stopRecording();
      
      // Trigger success animation
      setShowSuccess(true);
      successScale.value = withSequence(
        withSpring(1.05, { 
          damping: 10,
          stiffness: 180,
        }),
        withSpring(1, { 
          damping: 12,
          stiffness: 200,
        })
      );
      
      setTimeout(() => {
        setIsSaving(false);
        setShowSuccess(false);
        successScale.value = withTiming(0, { duration: 150 });
      }, 1800);
    } else {
      await startRecording();
    }
  };

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const timerContainerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timerContainerScale.value }],
    opacity: timerContainerOpacity.value,
  }));

  const successAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: interpolate(successScale.value, [0, 0.5, 1], [0, 1, 1]),
  }));

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Simulator Warning */}
      {isOnSimulator && (
        <Animated.View
          entering={SlideInUp.springify()}
          style={[styles.simulatorWarning, { backgroundColor: theme.warning + '15' }]}
        >
          <IconSymbol name="exclamationmark.triangle" size={20} color={theme.warning} />
          <ThemedText style={[styles.simulatorWarningText, { color: theme.warning }]}>
            {getSimulatorWarningMessage()}
          </ThemedText>
        </Animated.View>
      )}

      {/* Timer Display - Only visible when recording */}
      <Animated.View style={[styles.timerContainer, timerContainerAnimatedStyle]}>
        <View style={styles.timerRow}>
          {/* Minutes - no animation needed for single digit */}
          <ThemedText type="hero" style={[styles.timer, { color: theme.text }]}>
            {minutes}
          </ThemedText>
          
          <ThemedText type="hero" style={[styles.timer, { color: theme.text }]}>
            :
          </ThemedText>
          
          {/* Seconds - each digit animates independently */}
          <AnimatedDigit 
            value={secondTens} 
            style={styles.timer} 
            color={theme.text}
          />
          <AnimatedDigit 
            value={secondOnes} 
            style={styles.timer} 
            color={theme.text}
          />
        </View>
        <ThemedText type="caption" style={[styles.timerLabel, { color: theme.textMuted }]}>
          RECORDING
        </ThemedText>
      </Animated.View>

      {/* Main Record Button - Centered */}
      <View style={styles.buttonContainer}>
        <Animated.View style={buttonAnimatedStyle}>
          <Pressable
            style={[
              styles.recordButton,
              { 
                backgroundColor: isRecording ? theme.accent : theme.primary,
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
              color={isRecording ? theme.primary : theme.accent}
            />
          </Pressable>
        </Animated.View>

        {/* Button Label */}
        {!isRecording && !showSuccess && (
          <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut}>
            <ThemedText type="body" style={[styles.buttonLabel, { color: theme.textSecondary }]}>
              TAP TO RECORD
            </ThemedText>
          </Animated.View>
        )}
      </View>

      {/* Success Message */}
      {showSuccess && (
        <Animated.View style={[styles.successContainer, successAnimatedStyle]}>
          <View style={[styles.successCard, { backgroundColor: theme.card, borderColor: theme.primary + '20' }]}>
            <IconSymbol name="checkmark.circle.fill" size={48} color={theme.primary} />
            <ThemedText type="subheading" style={[styles.successText, { color: theme.text }]}>
              Saved
            </ThemedText>
          </View>
        </Animated.View>
      )}

      {/* Error Message */}
      {error && (
        <Animated.View
          entering={SlideInUp.springify()}
          exiting={FadeOut}
          style={[styles.errorCard, { backgroundColor: theme.error + '15' }]}
        >
          <IconSymbol name="exclamationmark.circle" size={20} color={theme.error} />
          <ThemedText style={[styles.errorText, { color: theme.error }]}>
            {error}
          </ThemedText>
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.25,
    alignItems: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timer: {
    fontSize: Typography.sizes.massive,
    lineHeight: Typography.sizes.massive,
    fontFamily: 'Inter-Black',
    letterSpacing: -2,
  },
  timerLabel: {
    marginTop: Spacing.sm,
    opacity: 0.6,
    letterSpacing: 1.5,
  },
  buttonContainer: {
    alignItems: 'center',
    gap: Spacing.xxl,
  },
  recordButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  buttonLabel: {
    marginTop: Spacing.lg,
    letterSpacing: 0.5,
  },
  successContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.3,
  },
  successCard: {
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.xxl,
    alignItems: 'center',
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  successText: {
    letterSpacing: -0.5,
  },
  successSubtext: {
    opacity: 0.85,
  },
  errorCard: {
    position: 'absolute',
    bottom: Spacing.huge,
    marginHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
  },
  simulatorWarning: {
    position: 'absolute',
    top: Spacing.huge * 2,
    marginHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  simulatorWarningText: {
    flex: 1,
    fontSize: Typography.sizes.xs,
    lineHeight: Typography.sizes.sm * 1.4,
  },
});