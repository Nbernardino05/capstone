import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      // AuthProvider state change → AppNavigator auto-switches to MainTabs
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.appName}>MedTracker</Text>
          <Text style={styles.title}>Patient Login</Text>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={Colors.TEXT_SECONDARY}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={Colors.TEXT_SECONDARY}
            secureTextEntry
            accessibilityLabel="Password"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={Colors.PRIMARY_TEXT} />
            ) : (
              <Text style={styles.buttonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => navigation.navigate('Welcome')}
            accessibilityRole="button"
          >
            <Text style={styles.outlineButtonText}>Register with Invite Code</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.BACKGROUND },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.PRIMARY,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 32,
  },
  error: {
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.TEXT_PRIMARY,
    backgroundColor: Colors.SURFACE,
    marginBottom: 16,
  },
  button: {
    backgroundColor: Colors.PRIMARY,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Colors.PRIMARY_TEXT, fontSize: 16, fontWeight: '700' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.BORDER },
  dividerText: { fontSize: 13, color: Colors.TEXT_SECONDARY },
  outlineButton: {
    borderWidth: 1,
    borderColor: Colors.PRIMARY,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineButtonText: { color: Colors.PRIMARY, fontSize: 16, fontWeight: '600' },
});
