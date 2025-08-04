import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  Layout,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  animated?: boolean;
  animationDelay?: number;
  animationDirection?: 'up' | 'down';
  padding?: keyof typeof Spacing;
  shadow?: keyof typeof Shadows;
}

export function Card({
  children,
  style,
  animated = false,
  animationDelay = 0,
  animationDirection = 'up',
  padding = 'lg',
  shadow = 'md',
}: CardProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const cardStyle: ViewStyle = {
    backgroundColor: theme.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: Spacing[padding],
    ...Shadows[shadow],
  };

  if (!animated) {
    return <View style={[cardStyle, style]}>{children}</View>;
  }

  const animation = animationDirection === 'up' ? FadeInUp : FadeInDown;

  return (
    <Animated.View
      entering={animation.delay(animationDelay).springify()}
      layout={Layout.springify()}
      style={[cardStyle, style]}
    >
      {children}
    </Animated.View>
  );
}