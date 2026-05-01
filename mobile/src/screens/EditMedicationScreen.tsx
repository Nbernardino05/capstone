import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useOnboarding } from '../context/OnboardingContext';
import { updateMedication as apiUpdate } from '../api/medications';
import FrequencyPicker from '../components/FrequencyPicker';
import { FREQUENCY_WHEN_OPTIONS, FREQUENCY_PERIOD_OPTIONS } from '../constants/frequencies';
import { DOSAGE_AMOUNT_OPTIONS, DOSAGE_METRIC_OPTIONS } from '../constants/dosages';
import { Colors } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'EditMedication'>;
type EditNavProp = NativeStackNavigationProp<RootStackParamList, 'EditMedication'>;

export default function EditMedicationScreen() {
  const navigation = useNavigation<EditNavProp>();
  const route = useRoute<Props['route']>();
  const { medication } = route.params;
  const { patientId, updateMedication } = useOnboarding();

  const [name, setName] = useState(medication.name);
  const [dosage, setDosage] = useState(medication.dosage);
  const [dosageMetric, setDosageMetric] = useState(medication.dosage_metric);
  const [frequencyWhen, setFrequencyWhen] = useState(medication.frequency_when);
  const [frequencyPeriod, setFrequencyPeriod] = useState(medication.frequency_period);

  const [nameError, setNameError] = useState<string | null>(null);
  const [dosageError, setDosageError] = useState<string | null>(null);
  const [dosageMetricError, setDosageMetricError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  async function handleSave() {
    let hasError = false;
    setNameError(null);
    setDosageError(null);
    setDosageMetricError(null);

    if (!name.trim()) {
      setNameError('Medication name is required');
      hasError = true;
    }
    if (!dosage.trim()) {
      setDosageError('Dosage is required');
      hasError = true;
    }
    if (!dosageMetric.trim()) {
      setDosageMetricError('Dosage metric is required');
      hasError = true;
    }
    if (hasError) return;

    setSaving(true);
    try {
      const updated = await apiUpdate(patientId, medication.id, {
        name: name.trim(),
        dosage: dosage.trim(),
        dosage_metric: dosageMetric.trim(),
        frequency_when: frequencyWhen || 'once',
        frequency_period: frequencyPeriod || 'daily',
      });
      updateMedication(updated);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Cancel and go back"
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Edit medication</Text>
            <Text style={styles.headerSubtitle}>{medication.name}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Medication Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Medication Name</Text>
            <TextInput
              style={[styles.input, nameError && styles.inputError]}
              value={name}
              onChangeText={text => { setName(text); setNameError(null); }}
              placeholder="Medication name"
              placeholderTextColor={Colors.TEXT_SECONDARY}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {nameError && <Text style={styles.inlineError}>{nameError}</Text>}
          </View>

          {/* Dosage */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Dosage</Text>
            <View style={styles.pickerRow}>
              <View style={[styles.pickerFlex, dosageError && styles.pickerError]}>
                <FrequencyPicker
                  label="Amount"
                  options={DOSAGE_AMOUNT_OPTIONS}
                  selectedValue={dosage}
                  onSelect={value => { setDosage(value); setDosageError(null); }}
                />
              </View>
              <View style={styles.pickerGap} />
              <View style={[styles.pickerFlex, dosageMetricError && styles.pickerError]}>
                <FrequencyPicker
                  label="Unit"
                  options={DOSAGE_METRIC_OPTIONS}
                  selectedValue={dosageMetric}
                  onSelect={value => { setDosageMetric(value); setDosageMetricError(null); }}
                />
              </View>
            </View>
            {dosageError && <Text style={styles.inlineError}>{dosageError}</Text>}
            {dosageMetricError && <Text style={styles.inlineError}>{dosageMetricError}</Text>}
          </View>

          {/* Frequency */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Frequency</Text>
            <View style={styles.pickerRow}>
              <FrequencyPicker
                label="How often"
                options={FREQUENCY_WHEN_OPTIONS}
                selectedValue={frequencyWhen}
                onSelect={setFrequencyWhen}
              />
              <View style={styles.pickerGap} />
              <FrequencyPicker
                label="When"
                options={FREQUENCY_PERIOD_OPTIONS}
                selectedValue={frequencyPeriod}
                onSelect={setFrequencyPeriod}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.BACKGROUND },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: Colors.BORDER,
  },
  backButton: { padding: 4, marginRight: 12 },
  backArrow: { fontSize: 22, color: Colors.PRIMARY, fontWeight: '600' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.TEXT_PRIMARY },
  headerSubtitle: { fontSize: 13, color: Colors.TEXT_SECONDARY, marginTop: 2 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.TEXT_PRIMARY, marginBottom: 8 },
  input: {
    backgroundColor: Colors.SURFACE,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.TEXT_PRIMARY,
  },
  inputError: { borderColor: Colors.ERROR },
  inlineError: { marginTop: 4, fontSize: 12, color: Colors.ERROR },
  pickerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  pickerGap: { width: 12 },
  pickerFlex: { flex: 1 },
  pickerError: { borderWidth: 1, borderColor: Colors.ERROR, borderRadius: 8 },
  saveButton: {
    backgroundColor: Colors.PRIMARY,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: { backgroundColor: Colors.DISABLED },
  saveButtonText: { color: Colors.PRIMARY_TEXT, fontSize: 16, fontWeight: '600' },
});
