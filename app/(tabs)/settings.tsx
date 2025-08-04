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
import { Settings } from '@/types';
import { storageService } from '@/services/storage';
import { DEFAULT_SETTINGS } from '@/utils/constants';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, Typography } from '@/constants/Colors';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await storageService.getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
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
      
      await storageService.saveSettings(settings);
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
          {/* API Configuration */}
          <Animated.View entering={FadeInDown.delay(100)}>
            <Card style={styles.section} animated animationDelay={100}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>API Configuration</ThemedText>
                <ThemedText style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                  Configure your API keys for transcription
                </ThemedText>
              </View>
              
              <Input
                label="Groq API Key"
                value={settings.groqApiKey}
                onChangeText={(text) => updateSetting('groqApiKey', text)}
                placeholder="Enter your Groq API key"
                secureTextEntry
                autoCapitalize="none"
              />
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

          {/* Supabase Configuration */}
          <Animated.View entering={FadeInDown.delay(300)}>
            <Card style={styles.section} animated animationDelay={300}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Supabase</ThemedText>
                <ThemedText style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                  Configure your Supabase project for storage
                </ThemedText>
              </View>
              
              <Input
                label="Project URL"
                value={settings.supabaseUrl}
                onChangeText={(text) => updateSetting('supabaseUrl', text)}
                placeholder="https://your-project.supabase.co"
                autoCapitalize="none"
                keyboardType="url"
                autoCorrect={false}
              />
              
              <Input
                label="Anon Key"
                value={settings.supabaseAnonKey}
                onChangeText={(text) => updateSetting('supabaseAnonKey', text)}
                placeholder="Your anonymous key"
                secureTextEntry
                autoCapitalize="none"
                containerStyle={{ marginBottom: 0 }}
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