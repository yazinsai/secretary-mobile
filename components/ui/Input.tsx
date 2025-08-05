import React from 'react';
import { TextInput, View, StyleSheet, TextInputProps, ViewStyle, Text } from 'react-native';
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
  ...props
}: InputProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: theme.text }]}>
          {label}
        </Text>
      )}
      
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.inputBackground,
            borderColor: error ? theme.error : theme.inputBorder,
            color: theme.text,
          }
        ]}
        placeholderTextColor={theme.textSecondary}
        {...props}
      />
      
      {error && (
        <Text style={[styles.errorText, { color: theme.error }]}>
          {error}
        </Text>
      )}
      
      {helperText && !error && (
        <Text style={[styles.helperText, { color: theme.textSecondary }]}>
          {helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    marginBottom: Spacing.xs,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.md,
  },
  errorText: {
    fontSize: Typography.sizes.xs,
    marginTop: Spacing.xs,
  },
  helperText: {
    fontSize: Typography.sizes.xs,
    marginTop: Spacing.xs,
  },
});