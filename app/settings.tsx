import { StyleSheet, ScrollView, View, Alert, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeIn,
  SlideInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DictionaryInput } from '@/components/ui/DictionaryInput';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Settings } from '@/types';
import { userSettingsService } from '@/services/userSettings';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_SETTINGS } from '@/utils/constants';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/Colors';
import Toast from 'react-native-toast-message';

interface SettingRowProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showBorder?: boolean;
}

const SettingRow = ({ icon, title, subtitle, onPress, rightElement, showBorder = true }: SettingRowProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  return (
    <Pressable 
      style={[
        styles.settingRow, 
        showBorder && { borderBottomColor: theme.cardBorder, borderBottomWidth: 1 }
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.backgroundSecondary }]}>
        <IconSymbol name={icon} size={20} color={theme.primary} />
      </View>
      <View style={styles.settingContent}>
        <ThemedText style={styles.settingTitle}>{title}</ThemedText>
        {subtitle && (
          <ThemedText style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </ThemedText>
        )}
      </View>
      {rightElement && (
        <View style={styles.rightElement}>
          {rightElement}
        </View>
      )}
      {onPress && (
        <IconSymbol name="chevron.right" size={16} color={theme.textSecondary} />
      )}
    </Pressable>
  );
};

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDictionary, setShowDictionary] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await userSettingsService.getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load settings',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await userSettingsService.saveSettings(settings);
      setHasChanges(false);
      
      Toast.show({
        type: 'success',
        text1: 'Settings saved',
        position: 'top',
        visibilityTime: 2000,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to save settings',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Do you want to save them?',
        [
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
          { text: 'Save', onPress: async () => {
            await saveSettings();
            router.back();
          }},
        ]
      );
    } else {
      router.back();
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerContent}>
          <ThemedText type="title" style={styles.title}>Settings</ThemedText>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color={theme.text} />
          </Pressable>
        </View>
      </View>
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Account Section */}
          <Animated.View entering={FadeInDown.delay(100)}>
            <ThemedText style={[styles.groupTitle, { color: theme.textSecondary }]}>
              ACCOUNT
            </ThemedText>
            <View style={[styles.groupContainer, { backgroundColor: theme.card }]}>
              <SettingRow
                icon="person"
                title={user ? user.email! : 'Not logged in'}
                subtitle="Manage your account"
                showBorder={false}
                rightElement={
                  user && (
                    <Button
                      onPress={async () => {
                        Alert.alert(
                          'Sign Out',
                          'Are you sure you want to sign out?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Sign Out',
                              style: 'destructive',
                              onPress: async () => {
                                await signOut();
                                router.back();
                              },
                            },
                          ]
                        );
                      }}
                      title="Sign Out"
                      variant="secondary"
                      size="small"
                    />
                  )
                }
              />
            </View>
          </Animated.View>

          {/* Integration Section */}
          <Animated.View entering={FadeInDown.delay(200)}>
            <ThemedText style={[styles.groupTitle, { color: theme.textSecondary }]}>
              INTEGRATIONS
            </ThemedText>
            <View style={[styles.groupContainer, { backgroundColor: theme.card }]}>
              <View style={styles.inputContainer}>
                <Input
                  label="Webhook URL"
                  value={settings.webhookUrl}
                  onChangeText={(text) => updateSetting('webhookUrl', text)}
                  placeholder="https://example.com/webhook"
                  autoCapitalize="none"
                  keyboardType="url"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>
            </View>
          </Animated.View>

          {/* Transcription Section */}
          <Animated.View entering={FadeInDown.delay(300)}>
            <ThemedText style={[styles.groupTitle, { color: theme.textSecondary }]}>
              TRANSCRIPTION
            </ThemedText>
            <View style={[styles.groupContainer, { backgroundColor: theme.card }]}>
              <SettingRow
                icon="book"
                title="Custom Dictionary"
                subtitle={`${settings.dictionary?.length || 0} terms added`}
                onPress={() => setShowDictionary(!showDictionary)}
                showBorder={showDictionary}
              />
              {showDictionary && (
                <Animated.View 
                  entering={FadeIn}
                  style={styles.dictionaryContainer}
                >
                  <DictionaryInput
                    value={settings.dictionary || []}
                    onChange={(dictionary) => updateSetting('dictionary', dictionary)}
                    placeholder="Add a term..."
                  />
                </Animated.View>
              )}
            </View>
          </Animated.View>

          {/* Save Button */}
          {hasChanges && (
            <Animated.View 
              entering={SlideInDown.springify()}
              style={styles.saveButtonContainer}
            >
              <Button
                onPress={saveSettings}
                title="Save Changes"
                size="large"
                loading={isSaving}
                style={styles.saveButton}
              />
            </Animated.View>
          )}
          
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
  },
  closeButton: {
    padding: Spacing.sm,
    margin: -Spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  title: {
    fontSize: Typography.sizes.xxxl,
    fontWeight: Typography.weights.bold,
    lineHeight: Typography.sizes.xxxl * 1.3,
  },
  groupTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
  },
  groupContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
  },
  settingSubtitle: {
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },
  rightElement: {
    marginRight: Spacing.sm,
  },
  inputContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  input: {
    marginBottom: 0,
  },
  dictionaryContainer: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  saveButtonContainer: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  saveButton: {
    width: '100%',
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },
});