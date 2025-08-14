import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';
import { ThemedText } from './ThemedText';
import { IconSymbol } from './ui/IconSymbol';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/Colors';

export const toastConfig: ToastConfig = {
  success: ({ text1, text2, props }) => (
    <View style={[styles.toast, styles.successToast]}>
      <View style={styles.iconContainer}>
        <IconSymbol name="checkmark.circle" size={24} color={Colors.light.primary} />
      </View>
      <View style={styles.textContainer}>
        <ThemedText type="bodyBold" style={styles.title}>
          {text1}
        </ThemedText>
        {text2 && (
          <ThemedText type="body" style={styles.message}>
            {text2}
          </ThemedText>
        )}
      </View>
    </View>
  ),
  
  error: ({ text1, text2, props }) => (
    <View style={[styles.toast, styles.errorToast]}>
      <View style={styles.iconContainer}>
        <IconSymbol name="exclamationmark.circle" size={24} color={Colors.light.error} />
      </View>
      <View style={styles.textContainer}>
        <ThemedText type="bodyBold" style={styles.title}>
          {text1}
        </ThemedText>
        {text2 && (
          <ThemedText type="body" style={styles.message}>
            {text2}
          </ThemedText>
        )}
      </View>
    </View>
  ),
  
  info: ({ text1, text2, props }) => (
    <View style={[styles.toast, styles.infoToast]}>
      <View style={styles.iconContainer}>
        <IconSymbol name="info.circle" size={24} color={Colors.light.info} />
      </View>
      <View style={styles.textContainer}>
        <ThemedText type="bodyBold" style={styles.title}>
          {text1}
        </ThemedText>
        {text2 && (
          <ThemedText type="body" style={styles.message}>
            {text2}
          </ThemedText>
        )}
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    marginHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    minHeight: 72,
    width: '90%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderWidth: 1,
  },
  successToast: {
    borderColor: Colors.light.primary + '30',
    backgroundColor: Colors.light.background,
  },
  errorToast: {
    borderColor: Colors.light.error + '30',
    backgroundColor: Colors.light.background,
  },
  infoToast: {
    borderColor: Colors.light.info + '30',
    backgroundColor: Colors.light.background,
  },
  iconContainer: {
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: Typography.sizes.lg,
    color: Colors.light.text,
    marginBottom: Spacing.xs / 2,
  },
  message: {
    fontSize: Typography.sizes.base,
    color: Colors.light.textSecondary,
  },
});