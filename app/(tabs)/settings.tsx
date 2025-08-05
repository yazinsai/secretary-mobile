import { StyleSheet, ScrollView, View, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeIn,
  SlideInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DictionaryInput } from '@/components/ui/DictionaryInput';
import { Settings } from '@/types';
import { userSettingsService } from '@/services/userSettings';
import { syncService } from '@/services/sync';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_SETTINGS } from '@/utils/constants';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, Typography } from '@/constants/Colors';
import Toast from 'react-native-toast-message';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Animated.View entering={FadeInDown}>
          <ThemedText type="title" style={styles.title}>Settings</ThemedText>
        </Animated.View>
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
          {/* User Account */}
          <Animated.View entering={FadeInDown.delay(100)}>
            <Card style={styles.section} animated animationDelay={100}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Account</ThemedText>
                <ThemedText style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                  {user ? user.email : 'Not logged in'}
                </ThemedText>
              </View>
              
              {user && (
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
                          },
                        },
                      ]
                    );
                  }}
                  title="Sign Out"
                  variant="secondary"
                  size="medium"
                />
              )}
            </Card>
          </Animated.View>


          {/* Webhook Configuration */}
          <Animated.View entering={FadeInDown.delay(200)}>
            <Card style={styles.section} animated animationDelay={200}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Webhook</ThemedText>
                <ThemedText style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                  Configure where to send your recordings
                </ThemedText>
              </View>
              
              <Input
                label="Webhook URL"
                value={settings.webhookUrl}
                onChangeText={(text) => updateSetting('webhookUrl', text)}
                placeholder="https://example.com/webhook"
                autoCapitalize="none"
                keyboardType="url"
                autoCorrect={false}
              />
            </Card>
          </Animated.View>


          {/* Dictionary Configuration */}
          <Animated.View entering={FadeInDown.delay(300)}>
            <Card style={styles.section} animated animationDelay={300}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Dictionary</ThemedText>
                <ThemedText style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                  Add custom terms for accurate transcription
                </ThemedText>
              </View>
              
              <DictionaryInput
                value={settings.dictionary || []}
                onChange={(dictionary) => updateSetting('dictionary', dictionary)}
                placeholder="Add a term..."
              />
            </Card>
          </Animated.View>

          {/* Webhook Actions */}
          <Animated.View entering={FadeInDown.delay(400)}>
            <Card style={styles.section} animated animationDelay={400}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Webhook Actions</ThemedText>
                <ThemedText style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                  Manage webhook delivery for recordings
                </ThemedText>
              </View>
              
              <Button
                onPress={async () => {
                  try {
                    const result = await syncService.resendAllFailedWebhooks();
                    if (result.successCount > 0 || result.failCount > 0) {
                      Toast.show({
                        type: 'info',
                        text1: 'Webhook Resend Complete',
                        text2: `Success: ${result.successCount}, Failed: ${result.failCount}`,
                        position: 'top',
                        visibilityTime: 3000,
                      });
                    } else {
                      Toast.show({
                        type: 'info',
                        text1: 'No failed webhooks found',
                        position: 'top',
                        visibilityTime: 2000,
                      });
                    }
                  } catch (error) {
                    Toast.show({
                      type: 'error',
                      text1: 'Failed to resend webhooks',
                      position: 'top',
                      visibilityTime: 3000,
                    });
                  }
                }}
                title="Resend Failed Webhooks"
                variant="secondary"
                size="medium"
              />
            </Card>
          </Animated.View>

          {/* Save Button */}
          {hasChanges && (
            <Animated.View 
              entering={SlideInDown.springify()}
              style={styles.saveButtonContainer}
            >
              <Button
                onPress={saveSettings}
                title="Save Settings"
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
    marginBottom: Spacing.xl,
    lineHeight: Typography.sizes.xxxl * 1.3,
  },
  section: {
    marginBottom: Spacing.xl,
    padding: Spacing.xl,
  },
  sectionHeader: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.xs,
  },
  sectionDescription: {
    fontSize: Typography.sizes.sm,
  },
  saveButtonContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  saveButton: {
    width: '100%',
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },
});