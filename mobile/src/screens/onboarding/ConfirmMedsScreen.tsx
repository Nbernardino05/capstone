import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useOnboarding } from '../../context/OnboardingContext';
import type { MedicationStatus } from '../../context/OnboardingContext';
import { getMedications, confirmMedications } from '../../api/medications';
import MedicationCard from '../../components/MedicationCard';
import { Colors } from '../../constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ConfirmMeds'>;

export default function ConfirmMedsScreen() {
  const navigation = useNavigation<Nav>();
  const { patientId, medications, setMedications, toggleMedicationStatus } = useOnboarding();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Derived lists
  const providerMeds = medications.filter(m => m.source === 'provider');
  const patientMeds = medications.filter(m => m.source === 'patient');
  const hasNoMeds = providerMeds.length === 0 && patientMeds.length === 0;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    getMedications(patientId)
      .then(data => {
        if (!cancelled) setMedications(data);
      })
      .catch(err => {
        if (!cancelled) setFetchError(err.message ?? 'Failed to load medications.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [patientId]);

  async function handleContinue() {
    setSubmitting(true);
    try {
      // Only send provider-added medications for confirmation; patient-added are always active
      const updates = providerMeds.map(m => ({ id: m.id, status: m.status }));
      if (updates.length > 0) {
        await confirmMedications(patientId, updates);
      }
      navigation.navigate('Reminders');
    } catch {
      Alert.alert('Error', 'Failed to save medications. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleToggle(id: number, status: MedicationStatus) {
    toggleMedicationStatus(id, status);
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Step indicator */}
      <View style={styles.indicatorRow}>
        {[1, 2, 3, 4, 5].map(n => (
          <View
            key={n}
            style={[styles.indicatorDot, n === 3 && styles.indicatorActive]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Confirm your medications</Text>
        <Text style={styles.subtitle}>
          Your provider has added the following. Let us know what you are still taking.
        </Text>

        {/* Loading state */}
        {loading && (
          <ActivityIndicator
            size="large"
            color={Colors.PRIMARY}
            style={styles.loader}
          />
        )}

        {/* Error state */}
        {!loading && fetchError && (
          <Text style={styles.errorText}>{fetchError}</Text>
        )}

        {/* Scenario 4: no medications at all */}
        {!loading && !fetchError && hasNoMeds && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              Your provider hasn't added your medications yet
            </Text>
            <Text style={styles.emptySubtitle}>
              Continue with no medications or manually add your own
            </Text>
          </View>
        )}

        {/* Provider-added medications (with Still Taking / Stopped toggles) */}
        {!loading && !fetchError && providerMeds.map(med => (
          <MedicationCard
            key={med.id}
            medication={med}
            onToggle={status => handleToggle(med.id, status)}
          />
        ))}

        {/* Patient-added medications (no toggle — always Still Taking) */}
        {!loading && !fetchError && patientMeds.map(med => (
          <MedicationCard
            key={med.id}
            medication={med}
            onToggle={null}
          />
        ))}

        {/* Add missing medication (ghost/outline button) */}
        {!loading && !fetchError && (
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => navigation.navigate('AddMissingMedication')}
          >
            <Text style={styles.outlineButtonText}>+ Add missing medication</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Continue button — always visible at bottom */}
      {!loading && !fetchError && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleContinue}
            disabled={submitting}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? 'Saving…' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.BACKGROUND,
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 16,
    paddingBottom: 8,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.BORDER,
  },
  indicatorActive: {
    backgroundColor: Colors.STEP_INDICATOR,
    width: 24,
    borderRadius: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.TEXT_SECONDARY,
    marginBottom: 24,
    lineHeight: 20,
  },
  loader: {
    marginTop: 40,
  },
  errorText: {
    color: Colors.ERROR,
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
  emptyState: {
    backgroundColor: Colors.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.TEXT_SECONDARY,
    textAlign: 'center',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: Colors.OUTLINE_BUTTON_BORDER,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: Colors.SURFACE,
  },
  outlineButtonText: {
    color: Colors.OUTLINE_BUTTON_TEXT,
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: Colors.BACKGROUND,
  },
  primaryButton: {
    backgroundColor: Colors.PRIMARY,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.DISABLED,
  },
  primaryButtonText: {
    color: Colors.PRIMARY_TEXT,
    fontSize: 16,
    fontWeight: '600',
  },
});
