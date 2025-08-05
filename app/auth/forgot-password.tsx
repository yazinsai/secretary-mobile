import { StyleSheet, View, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, Typography } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resetPassword } = useAuth();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await resetPassword(email);
      Alert.alert(
        'Success',
        'Password reset link has been sent to your email.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
          <Animated.View entering={FadeInDown}>
            <ThemedText type="title" style={styles.title}>Reset Password</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              Enter your email to receive a password reset link
            </ThemedText>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100)}>
            <Card style={styles.card} animated animationDelay={100}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={{ marginBottom: Spacing.lg }}
              />
              
              <Button
                onPress={handleResetPassword}
                title="Send Reset Link"
                size="large"
                loading={loading}
                style={styles.button}
              />
              
              <View style={styles.footer}>
                <Button
                  onPress={() => router.back()}
                  title="Back to Login"
                  variant="ghost"
                  size="small"
                />
              </View>
            </Card>
          </Animated.View>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.sizes.xxxl,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.lg,
    textAlign: 'center',
    marginBottom: Spacing.xxxl,
  },
  card: {
    padding: Spacing.xl,
  },
  button: {
    width: '100%',
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
});