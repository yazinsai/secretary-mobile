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

export default function SignupScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await signUp(email, password);
      Alert.alert(
        'Success',
        'Account created! Please check your email to verify your account.',
        [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
      );
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'Unable to create account');
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
            <ThemedText type="title" style={styles.title}>Create Account</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              Sign up to get started
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
              />
              
              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                secureTextEntry
                autoCapitalize="none"
              />
              
              <Input
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                secureTextEntry
                autoCapitalize="none"
                containerStyle={{ marginBottom: Spacing.lg }}
              />
              
              <Button
                onPress={handleSignup}
                title="Create Account"
                size="large"
                loading={loading}
                style={styles.button}
              />
              
              <View style={styles.footer}>
                <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
                  Already have an account?
                </ThemedText>
                <Button
                  onPress={() => router.back()}
                  title="Sign In"
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    fontSize: Typography.sizes.sm,
    marginRight: Spacing.xs,
  },
});