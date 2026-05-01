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
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<Nav>();
  const { validateInviteCode } = useAuth();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleNext() {
    setError('');
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter your invitation code.');
      return;
    }
    setLoading(true);
    try {
      const invite = await validateInviteCode(trimmed);
      navigation.navigate('Profile', {
        invitationCode: trimmed,
        patientName: invite.patient_name,
        patientEmail: invite.patient_email,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid invitation code';
      setError(msg);
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
          <Text style={styles.step}>Step 1 of 5</Text>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>
            Enter the invitation code from your clinician to get started.
          </Text>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.label}>Invitation Code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={t => setCode(t.toUpperCase())}
            placeholder="e.g. A1B2C3D4"
            placeholderTextColor={Colors.TEXT_SECONDARY}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Invitation code"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={Colors.PRIMARY_TEXT} />
            ) : (
              <Text style={styles.buttonText}>Next</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.BACKGROUND },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  step: { fontSize: 13, color: Colors.TEXT_SECONDARY, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.TEXT_PRIMARY, marginBottom: 12 },
  subtitle: {
    fontSize: 15,
    color: Colors.TEXT_SECONDARY,
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
    fontSize: 16,
    color: Colors.TEXT_PRIMARY,
    backgroundColor: Colors.SURFACE,
    marginBottom: 24,
    letterSpacing: 2,
  },
  button: {
    backgroundColor: Colors.PRIMARY,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Colors.PRIMARY_TEXT, fontSize: 16, fontWeight: '600' },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  backButtonText: { color: Colors.PRIMARY, fontSize: 15, fontWeight: '500' },
});
