import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOnboarding } from '../context/OnboardingContext';
import type { Medication } from '../context/OnboardingContext';
import { logDose, getTodayLogs } from '../api/medications';
import { getTodaySurvey } from '../api/surveys';
import type { MedicationLog } from '../api/medications';
import { Colors } from '../constants/colors';
import { formatFrequency } from '../constants/frequencies';
import { isAsNeeded, isWithin30Min, getMostRecentLog, formatTime } from '../utils/doseUtils';
import type { RootStackParamList } from '../navigation/AppNavigator';

type HomeNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const { patientId, medications } = useOnboarding();

  const [sessionLogs, setSessionLogs] = useState<MedicationLog[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const activeMeds = medications.filter(m => m.status === 'active' && !dismissedIds.has(m.id));

  useEffect(() => {
    getTodayLogs(patientId)
      .then(setSessionLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  const promptSurveyIfNeeded = useCallback(async () => {
    try {
      const existing = await getTodaySurvey(patientId);
      if (!existing) {
        Alert.alert(
          'Daily Check-In',
          'Would you like to complete your daily medication check-in?',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Start check-in',
              onPress: () => navigation.navigate('Survey'),
            },
          ]
        );
      }
    } catch {
      // non-fatal — don't block dose logging
    }
  }, [patientId, navigation]);

  const performLog = useCallback(
    async (medicationId: number) => {
      try {
        const newLog = await logDose(patientId, medicationId);
        setSessionLogs(prev => [...prev, newLog]);
        // Offer the survey prompt after first successful log of the day
        promptSurveyIfNeeded();
      } catch {
        Alert.alert('Error', 'Could not save your dose. Please try again.');
      }
    },
    [patientId, promptSurveyIfNeeded]
  );

  const handleCheckmark = useCallback(
    (med: Medication) => {
      if (isAsNeeded(med)) {
        const recent = getMostRecentLog(sessionLogs, med.id);
        if (recent && isWithin30Min(recent.logged_at)) {
          Alert.alert(
            '',
            'You already logged a dose recently. Log another?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Confirm', onPress: () => performLog(med.id) },
            ]
          );
          return;
        }
      }
      performLog(med.id);
    },
    [sessionLogs, performLog]
  );

  function renderMedCard({ item }: { item: Medication }) {
    const asNeeded = isAsNeeded(item);
    const recentLog = getMostRecentLog(sessionLogs, item.id);
    const logged = !!recentLog;
    const showButtons = asNeeded || !logged;
    const frequencyLabel = formatFrequency(item.frequency_when, item.frequency_period);

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.medName}>{item.name}</Text>
          <Text style={styles.medDetail}>
            {item.dosage} {item.dosage_metric}
            {frequencyLabel ? `  |  ${frequencyLabel}` : ''}
          </Text>
          {logged && !showButtons && (
            <Text style={styles.loggedLabel}>
              ✓ Logged  {formatTime(recentLog!.logged_at)}
            </Text>
          )}
          {logged && asNeeded && (
            <Text style={styles.loggedLabel}>
              ✓ Logged  {formatTime(recentLog!.logged_at)}
            </Text>
          )}
        </View>

        {showButtons && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.iconBtn, styles.skipBtn]}
              onPress={() => setDismissedIds(prev => new Set(prev).add(item.id))}
              accessibilityLabel="Skip dose"
              accessibilityRole="button"
            >
              <Text style={styles.skipIcon}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, styles.logBtn]}
              onPress={() => handleCheckmark(item)}
              accessibilityLabel="Log dose"
              accessibilityRole="button"
            >
              <Text style={styles.logIcon}>✓</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  function renderEmpty() {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No medications added yet</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddMissingMedication')}
          accessibilityRole="button"
        >
          <Text style={styles.addBtnText}>Add medication</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.appName}>MedTracker</Text>
            <Text style={styles.greeting}>Good morning</Text>
          </View>
          <TouchableOpacity
            style={styles.checkInBtn}
            onPress={() => navigation.navigate('Survey')}
            accessibilityRole="button"
            accessibilityLabel="Daily Check-In"
          >
            <Text style={styles.checkInBtnText}>Daily Check-In</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={Colors.PRIMARY} />
      ) : (
        <FlatList
          data={activeMeds}
          keyExtractor={item => String(item.id)}
          renderItem={renderMedCard}
          contentContainerStyle={[
            styles.list,
            activeMeds.length === 0 && styles.listEmpty,
          ]}
          ListEmptyComponent={renderEmpty}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.BACKGROUND },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appName: { fontSize: 20, fontWeight: '700', color: Colors.TEXT_PRIMARY },
  greeting: { fontSize: 14, color: Colors.TEXT_SECONDARY, marginTop: 2 },
  checkInBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.PRIMARY,
  },
  checkInBtnText: { fontSize: 13, fontWeight: '700', color: Colors.PRIMARY_TEXT },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingTop: 8 },
  listEmpty: { flex: 1 },
  card: {
    backgroundColor: Colors.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: { flex: 1, marginRight: 12 },
  medName: { fontSize: 16, fontWeight: '700', color: Colors.TEXT_PRIMARY, marginBottom: 4 },
  medDetail: { fontSize: 13, color: Colors.TEXT_SECONDARY },
  loggedLabel: {
    fontSize: 13,
    color: Colors.PRIMARY,
    fontWeight: '600',
    marginTop: 6,
  },
  buttonRow: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: { borderColor: Colors.BORDER, backgroundColor: Colors.SURFACE },
  logBtn: { borderColor: Colors.PRIMARY, backgroundColor: Colors.PRIMARY },
  skipIcon: { fontSize: 14, color: Colors.TEXT_SECONDARY, fontWeight: '600' },
  logIcon: { fontSize: 16, color: Colors.PRIMARY_TEXT, fontWeight: '700' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 16, color: Colors.TEXT_SECONDARY, marginBottom: 16, textAlign: 'center' },
  addBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.OUTLINE_BUTTON_BORDER,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: Colors.OUTLINE_BUTTON_TEXT },
});
