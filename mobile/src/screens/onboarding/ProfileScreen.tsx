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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Props['route']>();
  const { register } = useAuth();

  const { invitationCode, patientName, patientEmail } = route.params;

  const [email, setEmail] = useState(patientEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) errs.email = 'Email is required';
    else if (!emailRe.test(email.trim())) errs.email = 'Invalid email format';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(invitationCode, email.trim(), password);
      // After registration, proceed to medication confirmation
      navigation.navigate('ConfirmMeds');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.step}>Step 2 of 5</Text>
          <Text style={styles.title}>Your Profile</Text>
          <Text style={styles.subtitle}>
            Welcome, <Text style={styles.bold}>{patientName}</Text>. Create your account to get started.
          </Text>

          {!!errors.general && <Text style={styles.errorBox}>{errors.general}</Text>}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, !!errors.email && styles.inputError]}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={Colors.TEXT_SECONDARY}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email"
          />
          {!!errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, !!errors.password && styles.inputError]}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={Colors.TEXT_SECONDARY}
            secureTextEntry
            accessibilityLabel="Password"
          />
          {!!errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={[styles.input, !!errors.confirmPassword && styles.inputError]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter password"
            placeholderTextColor={Colors.TEXT_SECONDARY}
            secureTextEntry
            accessibilityLabel="Confirm password"
          />
          {!!errors.confirmPassword && <Text style={styles.fieldError}>{errors.confirmPassword}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={Colors.PRIMARY_TEXT} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.BACKGROUND },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingTop: 16 },
  back: { marginBottom: 16 },
  backText: { color: Colors.PRIMARY, fontSize: 15 },
  step: { fontSize: 13, color: Colors.TEXT_SECONDARY, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.TEXT_PRIMARY, marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.TEXT_SECONDARY, marginBottom: 28 },
  bold: { fontWeight: '700', color: Colors.TEXT_PRIMARY },
  errorBox: {
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
    marginBottom: 4,
  },
  inputError: { borderColor: '#EF4444' },
  fieldError: { color: '#EF4444', fontSize: 12, marginBottom: 12 },
  button: {
    backgroundColor: Colors.PRIMARY,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Colors.PRIMARY_TEXT, fontSize: 16, fontWeight: '700' },
});
