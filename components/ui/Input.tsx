import React, { useState } from 'react';
import { TextInput, View, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ThemedText';
import { Colors, BorderRadius, Spacing, Typography } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  helperText,
  containerStyle,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [isFocused, setIsFocused] = useState(false);
  
  const focusAnimation = useSharedValue(0);
  const errorAnimation = useSharedValue(error ? 1 : 0);

  React.useEffect(() => {
    errorAnimation.value = withTiming(error ? 1 : 0, { duration: 200 });
  }, [error]);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    focusAnimation.value = withTiming(1, { duration: 200 });
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    focusAnimation.value = withTiming(0, { duration: 200 });
    onBlur?.(e);
  };

  const labelAnimatedStyle = useAnimatedStyle(() => {
    const hasValue = props.value && props.value.length > 0;
    const shouldFloat = focusAnimation.value === 1 || hasValue;
    
    return {
      transform: [
        {
          translateY: interpolate(
            shouldFloat ? 1 : 0,
            [0, 1],
            [0, -30],
            Extrapolate.CLAMP
          ),
        },
        {
          scale: interpolate(
            shouldFloat ? 1 : 0,
            [0, 1],
            [1, 0.75],
            Extrapolate.CLAMP
          ),
        },
      ],
    };
  });

  const inputContainerAnimatedStyle = useAnimatedStyle(() => {
    const borderColor = interpolate(
      errorAnimation.value,
      [0, 1],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      borderColor: error
        ? theme.error
        : isFocused
        ? theme.primary
        : theme.inputBorder,
      borderWidth: isFocused ? 2 : 1,
    };
  });

  return (
    <View style={[styles.container, containerStyle]}>
      <Animated.View
        style={[
          styles.inputContainer,
          { backgroundColor: theme.inputBackground },
          inputContainerAnimatedStyle,
        ]}
      >
        {label && (
          <Animated.View style={[styles.labelContainer, labelAnimatedStyle]}>
            <View style={[styles.labelBackground, { backgroundColor: theme.background }]}>
              <ThemedText
                style={[
                  styles.label,
                  {
                    color: error
                      ? theme.error
                      : isFocused
                      ? theme.primary
                      : theme.textSecondary,
                  },
                ]}
              >
                {label}
              </ThemedText>
            </View>
          </Animated.View>
        )}
        
        <TextInput
          style={[
            styles.input,
            { 
              color: theme.text,
              paddingTop: label ? Spacing.xxl : Spacing.lg,
            },
          ]}
          placeholderTextColor={theme.textSecondary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
      </Animated.View>
      
      {(error || helperText) && (
        <View style={styles.helperContainer}>
          <ThemedText
            style={[
              styles.helperText,
              { color: error ? theme.error : theme.textSecondary },
            ]}
          >
            {error || helperText}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    borderRadius: BorderRadius.lg,
    position: 'relative',
    overflow: 'visible',
  },
  labelContainer: {
    position: 'absolute',
    left: Spacing.lg - 4,
    top: 18,
    zIndex: 1,
  },
  labelBackground: {
    paddingHorizontal: 4,
  },
  label: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    lineHeight: Typography.sizes.base * 1.2,
  },
  input: {
    fontSize: Typography.sizes.base,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    minHeight: 64,
  },
  helperContainer: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  helperText: {
    fontSize: Typography.sizes.sm,
  },
});