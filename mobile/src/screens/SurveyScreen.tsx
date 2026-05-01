import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOnboarding } from '../context/OnboardingContext';
import { getTodaySurvey, submitSurvey } from '../api/surveys';
import type { SurveyResponse } from '../api/surveys';
import { Colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type SurveyNavProp = NativeStackNavigationProp<RootStackParamList, 'Survey'>;

const EFFICACY_LABELS: Record<number, string> = {
  1: 'Not effective',
  2: 'Slightly effective',
  3: 'Moderately effective',
  4: 'Very effective',
  5: 'Extremely effective',
};

const SIDE_EFFECT_OPTIONS = [
  'Nausea', 'Headache', 'Fatigue', 'Dizziness', 'Insomnia',
  'Dry mouth', 'Appetite changes', 'Mood changes', 'None', 'Other',
];

const KNOWN_EFFECTS = new Set(SIDE_EFFECT_OPTIONS);

type MedRating = {
  medication_id: number;
  medication_name: string;
  efficacy_rating: number; // 0 = not yet rated
  side_effects: string[];
};

export default function SurveyScreen() {
  const navigation = useNavigation<SurveyNavProp>();
  const { patientId, medications } = useOnboarding();

  const [ratings, setRatings] = useState<MedRating[]>([]);
  const [otherTextMap, setOtherTextMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingSurveyId, setExistingSurveyId] = useState<number | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const existing = await getTodaySurvey(patientId);
        if (existing) {
          setExistingSurveyId(existing.id);
        }

        const existingByMedId = new Map<number, SurveyResponse>(
          existing?.responses?.map(r => [r.medication_id, r]) ?? []
        );

        const newOtherTextMap: Record<number, string> = {};

        // Show all active medications, not just logged ones
        const activeMeds = medications.filter(m => m.status === 'active');

        const initial: MedRating[] = activeMeds.map(med => {
          const prev = existingByMedId.get(med.id);
          const sideEffectsArr: string[] = prev?.side_effects
            ? prev.side_effects.split(',').map(s => s.trim()).filter(Boolean)
            : [];

          // Split into known effects and custom (Other) text
          const normalEffects = sideEffectsArr.filter(e => KNOWN_EFFECTS.has(e));
          const customEffects = sideEffectsArr.filter(e => !KNOWN_EFFECTS.has(e));
          if (customEffects.length > 0) {
            newOtherTextMap[med.id] = customEffects.join(', ');
            if (!normalEffects.includes('Other')) normalEffects.push('Other');
          }

          return {
            medication_id: med.id,
            medication_name: med.name,
            efficacy_rating: prev?.efficacy_rating ?? 0,
            side_effects: normalEffects,
          };
        });

        setRatings(initial);
        setOtherTextMap(newOtherTextMap);
      } catch {
        Alert.alert('Error', 'Could not load survey data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [patientId, medications]);

  function setEfficacy(medId: number, rating: number) {
    setRatings(prev =>
      prev.map(r => r.medication_id === medId ? { ...r, efficacy_rating: rating } : r)
    );
  }

  function toggleSideEffect(medId: number, effect: string) {
    setRatings(prev =>
      prev.map(r => {
        if (r.medication_id !== medId) return r;
        const has = r.side_effects.includes(effect);
        if (effect === 'None') {
          if (!has) setOtherTextMap(m => ({ ...m, [medId]: '' }));
          return { ...r, side_effects: has ? [] : ['None'] };
        }
        if (effect === 'Other' && has) {
          setOtherTextMap(m => ({ ...m, [medId]: '' }));
        }
        const next = has
          ? r.side_effects.filter(e => e !== effect)
          : [...r.side_effects.filter(e => e !== 'None'), effect];
        return { ...r, side_effects: next };
      })
    );
  }

  async function handleSubmit() {
    const unrated = ratings.filter(r => r.efficacy_rating === 0);
    if (unrated.length > 0) {
      Alert.alert(
        'Rating required',
        `Please rate all medications before submitting. Missing: ${unrated.map(r => r.medication_name).join(', ')}`
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitSurvey(
        patientId,
        ratings.map(r => {
          const resolvedEffects = r.side_effects.map(e => {
            if (e === 'Other') {
              const custom = (otherTextMap[r.medication_id] ?? '').trim();
              return custom || 'Other';
            }
            return e;
          });
          return {
            medication_id: r.medication_id,
            medication_name: r.medication_name,
            efficacy_rating: r.efficacy_rating,
            side_effects: resolvedEffects.join(', ') || undefined,
          };
        })
      );
      Alert.alert(
        existingSurveyId ? 'Survey updated' : 'Check-in complete',
        'Your response has been recorded.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert('Error', 'Could not submit survey. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={styles.loader} color={Colors.PRIMARY} />
      </SafeAreaView>
    );
  }

  if (ratings.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Daily Check-In</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No active medications to rate.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Daily Check-In</Text>
        <Text style={styles.subtitle}>
          {existingSurveyId ? 'Update your responses below.' : 'How are your medications affecting you today?'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {ratings.map(rating => (
          <View key={rating.medication_id} style={styles.medSection}>
            <Text style={styles.medName}>{rating.medication_name}</Text>

            {/* Efficacy Rating 1–5 */}
            <Text style={styles.fieldLabel}>How effective was it today?</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.ratingBtn,
                    rating.efficacy_rating === n && styles.ratingBtnSelected,
                  ]}
                  onPress={() => setEfficacy(rating.medication_id, n)}
                  accessibilityRole="button"
                  accessibilityLabel={EFFICACY_LABELS[n]}
                  accessibilityState={{ selected: rating.efficacy_rating === n }}
                >
                  <Text
                    style={[
                      styles.ratingBtnText,
                      rating.efficacy_rating === n && styles.ratingBtnTextSelected,
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {rating.efficacy_rating > 0 && (
              <Text style={styles.ratingCaption}>
                {EFFICACY_LABELS[rating.efficacy_rating]}
              </Text>
            )}

            {/* Side Effects */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
              Any side effects? (select all that apply)
            </Text>
            <View style={styles.sideEffectsGrid}>
              {SIDE_EFFECT_OPTIONS.map(effect => {
                const selected = rating.side_effects.includes(effect);
                return (
                  <TouchableOpacity
                    key={effect}
                    style={[styles.sideEffectChip, selected && styles.sideEffectChipSelected]}
                    onPress={() => toggleSideEffect(rating.medication_id, effect)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    <Text
                      style={[
                        styles.sideEffectText,
                        selected && styles.sideEffectTextSelected,
                      ]}
                    >
                      {effect}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Other text input */}
            {rating.side_effects.includes('Other') && (
              <TextInput
                style={styles.otherInput}
                placeholder="Describe your side effect…"
                placeholderTextColor={Colors.TEXT_SECONDARY}
                value={otherTextMap[rating.medication_id] ?? ''}
                onChangeText={text =>
                  setOtherTextMap(prev => ({ ...prev, [rating.medication_id]: text }))
                }
              />
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
        >
          <Text style={styles.submitBtnText}>
            {submitting ? 'Submitting…' : existingSurveyId ? 'Update' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.BACKGROUND },
  loader: { marginTop: 60 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.BORDER,
  },
  closeBtn: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  closeText: { fontSize: 18, color: Colors.TEXT_SECONDARY },
  title: { fontSize: 22, fontWeight: '700', color: Colors.TEXT_PRIMARY, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.TEXT_SECONDARY },
  scrollContent: { padding: 20, paddingBottom: 48 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 16, color: Colors.TEXT_SECONDARY, textAlign: 'center' },
  medSection: {
    backgroundColor: Colors.SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    padding: 16,
    marginBottom: 16,
  },
  medName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.TEXT_SECONDARY,
    marginBottom: 10,
  },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    alignItems: 'center',
  },
  ratingBtnSelected: {
    backgroundColor: Colors.PRIMARY,
    borderColor: Colors.PRIMARY,
  },
  ratingBtnText: { fontSize: 16, fontWeight: '700', color: Colors.TEXT_PRIMARY },
  ratingBtnTextSelected: { color: Colors.PRIMARY_TEXT },
  ratingCaption: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.TEXT_SECONDARY,
    fontStyle: 'italic',
  },
  sideEffectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sideEffectChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    backgroundColor: Colors.SURFACE,
  },
  sideEffectChipSelected: {
    backgroundColor: Colors.PRIMARY,
    borderColor: Colors.PRIMARY,
  },
  sideEffectText: { fontSize: 13, color: Colors.TEXT_PRIMARY },
  sideEffectTextSelected: { color: Colors.PRIMARY_TEXT, fontWeight: '600' },
  otherInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.TEXT_PRIMARY,
    backgroundColor: Colors.BACKGROUND,
  },
  submitBtn: {
    backgroundColor: Colors.PRIMARY,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: Colors.DISABLED },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: Colors.PRIMARY_TEXT },
});
