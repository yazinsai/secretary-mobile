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

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
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
            <ThemedText type="title" style={styles.title}>Welcome Back</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              Sign in to your account
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
                placeholder="Enter your password"
                secureTextEntry
                autoCapitalize="none"
                containerStyle={{ marginBottom: Spacing.lg }}
              />
              
              <Button
                onPress={handleLogin}
                title="Sign In"
                size="large"
                loading={loading}
                style={styles.button}
              />
              
              <View style={styles.links}>
                <Button
                  onPress={() => router.push('/auth/signup')}
                  title="Create Account"
                  variant="ghost"
                  size="small"
                />
                
                <Button
                  onPress={() => router.push('/auth/forgot-password')}
                  title="Forgot Password?"
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
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
  },
});