import React, { useState, useRef, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useOnboarding } from '../../context/OnboardingContext';
import { addMedication } from '../../api/medications';
import { searchRxTerms } from '../../api/rxterms';
import FrequencyPicker from '../../components/FrequencyPicker';
import { FREQUENCY_WHEN_OPTIONS, FREQUENCY_PERIOD_OPTIONS } from '../../constants/frequencies';
import { DOSAGE_AMOUNT_OPTIONS, DOSAGE_METRIC_OPTIONS } from '../../constants/dosages';
import { Colors } from '../../constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AddMissingMedication'>;

export default function AddMissingMedicationScreen() {
  const navigation = useNavigation<Nav>();
  const { patientId, addMedication: addToContext } = useOnboarding();

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [dosageMetric, setDosageMetric] = useState('');
  const [frequencyWhen, setFrequencyWhen] = useState('');
  const [frequencyPeriod, setFrequencyPeriod] = useState('');

  // Inline validation errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [dosageError, setDosageError] = useState<string | null>(null);
  const [dosageMetricError, setDosageMetricError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, []);

  function handleNameChange(text: string) {
    setName(text);
    setNameError(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(async () => {
      const results = await searchRxTerms(text);
      setSuggestions(results);
    }, 300);
  }

  function handleSelectSuggestion(item: string) {
    setName(item);
    setSuggestions([]);
  }

  function clearErrors() {
    setNameError(null);
    setDosageError(null);
    setDosageMetricError(null);
  }

  async function handleAdd() {
    // Client-side validation — all required fields
    let hasError = false;
    clearErrors();

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
    if (hasError) return; // Stay on screen, preserve all values

    setSubmitting(true);
    try {
      const saved = await addMedication(patientId, {
        name: name.trim(),
        dosage: dosage.trim(),
        dosage_metric: dosageMetric.trim(),
        frequency_when: frequencyWhen || 'once',
        frequency_period: frequencyPeriod || 'daily',
      });
      addToContext(saved);       // Add to context so Step 3 list updates
      navigation.goBack();       // Return to Step 3 (Scenario 1, 3)
    } catch {
      Alert.alert('Error', 'Failed to add medication. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Custom header with back/cancel arrow */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()} // Scenario 4: cancel with no save
            accessibilityRole="button"
            accessibilityLabel="Cancel and go back"
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Add missing medication</Text>
            <Text style={styles.headerSubtitle}>Add anything else you take</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Medication Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Medication Name</Text>
            <View style={styles.autocompleteWrapper}>
              <TextInput
                style={[styles.input, nameError && styles.inputError]}
                value={name}
                onChangeText={handleNameChange}
                placeholder="e.g. Omega-3"
                placeholderTextColor={Colors.TEXT_SECONDARY}
                returnKeyType="next"
                autoCapitalize="words"
                autoCorrect={false}
              />
              {suggestions.length > 0 && (
                <View style={styles.suggestionList}>
                  {suggestions.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.suggestionItem,
                        index < suggestions.length - 1 && styles.suggestionItemBorder,
                      ]}
                      onPress={() => handleSelectSuggestion(item)}
                    >
                      <Text style={styles.suggestionText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            {nameError && <Text style={styles.inlineError}>{nameError}</Text>}
          </View>

          {/* Dosage + Dosage Metric side-by-side dropdowns */}
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

          {/* Frequency: two side-by-side pickers */}
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

          {/* Add button */}
          <TouchableOpacity
            style={[styles.addButton, submitting && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={submitting}
          >
            <Text style={styles.addButtonText}>
              {submitting ? 'Adding…' : 'Add'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: Colors.BORDER,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  backArrow: {
    fontSize: 22,
    color: Colors.PRIMARY,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.TEXT_PRIMARY,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.TEXT_SECONDARY,
    marginTop: 2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    zIndex: 1,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 8,
  },
  autocompleteWrapper: {
    position: 'relative',
    zIndex: 10,
  },
  suggestionList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.SURFACE,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    borderRadius: 8,
    marginTop: 2,
    zIndex: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.BORDER,
  },
  suggestionText: {
    fontSize: 15,
    color: Colors.TEXT_PRIMARY,
  },
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
  inputError: {
    borderColor: Colors.ERROR,
  },
  inlineError: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.ERROR,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pickerGap: {
    width: 12,
  },
  pickerFlex: {
    flex: 1,
  },
  pickerError: {
    borderWidth: 1,
    borderColor: Colors.ERROR,
    borderRadius: 8,
  },
  addButton: {
    backgroundColor: Colors.PRIMARY,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonDisabled: {
    backgroundColor: Colors.DISABLED,
  },
  addButtonText: {
    color: Colors.PRIMARY_TEXT,
    fontSize: 16,
    fontWeight: '600',
  },
});
