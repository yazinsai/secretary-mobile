import React from 'react';
import { Pressable, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { Colors, BorderRadius, Spacing, Typography, Shadows } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  onPress: () => void;
  title?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
  style?: ViewStyle;
  haptic?: boolean;
}

export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  children,
  style,
  haptic = true,
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    'worklet';
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(0.8, { duration: 100 });
  };

  const handlePressOut = () => {
    'worklet';
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(1, { duration: 100 });
  };

  const handlePress = () => {
    if (haptic && !disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.md,
    };

    // Size styles
    const sizeStyles: Record<string, ViewStyle> = {
      small: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        minHeight: 36,
      },
      medium: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        minHeight: 48,
      },
      large: {
        paddingHorizontal: Spacing.xxl,
        paddingVertical: Spacing.lg,
        minHeight: 56,
      },
    };

    // Variant styles
    const variantStyles: Record<string, ViewStyle> = {
      primary: {
        backgroundColor: disabled ? theme.primaryLight : theme.primary,
      },
      secondary: {
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.cardBorder,
      },
      ghost: {
        backgroundColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
    };
  };

  const getTextStyle = (): TextStyle => {
    const sizeStyles: Record<string, TextStyle> = {
      small: {
        fontSize: Typography.sizes.sm,
      },
      medium: {
        fontSize: Typography.sizes.base,
      },
      large: {
        fontSize: Typography.sizes.lg,
      },
    };

    const variantStyles: Record<string, TextStyle> = {
      primary: {
        color: theme.accent,
      },
      secondary: {
        color: theme.text,
      },
      ghost: {
        color: theme.primary,
      },
    };

    return {
      fontWeight: Typography.weights.semibold,
      ...sizeStyles[size],
      ...variantStyles[variant],
      opacity: disabled ? 0.5 : 1,
    };
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[getButtonStyle(), animatedStyle, style]}
    >
      {children || (
        <ThemedText style={getTextStyle()}>
          {loading ? 'Loading...' : title}
        </ThemedText>
      )}
    </AnimatedPressable>
  );
}