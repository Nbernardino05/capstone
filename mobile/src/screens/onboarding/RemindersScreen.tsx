import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Switch,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOnboarding } from '../../context/OnboardingContext';
import type { Medication } from '../../context/OnboardingContext';
import { setReminder as apiSetReminder, getReminders } from '../../api/medications';
import {
  requestNotificationPermission,
  scheduleReminder,
  cancelReminder,
} from '../../utils/reminders';
import { Colors } from '../../constants/colors';
import { formatFrequency } from '../../constants/frequencies';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type RemindersNavProp = NativeStackNavigationProp<RootStackParamList, 'Reminders'>;

// Preset reminder times shown in the picker
const TIME_OPTIONS = [
  '06:00', '07:00', '07:30', '08:00', '08:30',
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00', '22:00',
];

function formatTime12h(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

type ReminderState = {
  enabled: boolean;
  time: string; // 'HH:MM'
};

export default function RemindersScreen() {
  const navigation = useNavigation<RemindersNavProp>();
  const { patientId, medications } = useOnboarding();
  const activeMeds = medications.filter(m => m.status === 'active');

  // Map of medicationId → reminder state
  const [reminders, setReminders] = useState<Record<number, ReminderState>>({});
  const [pickerMedId, setPickerMedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // Load any existing reminders from the backend (e.g., if user navigates back/forward)
  useEffect(() => {
    getReminders(patientId)
      .then(existing => {
        const map: Record<number, ReminderState> = {};
        for (const r of existing) {
          map[r.medication_id] = { enabled: r.enabled === 1, time: r.reminder_time };
        }
        setReminders(map);
      })
      .catch(() => {}) // non-fatal; start with empty
      .finally(() => setLoadingExisting(false));
  }, [patientId]);

  function getReminderState(medId: number): ReminderState {
    return reminders[medId] ?? { enabled: false, time: '08:00' };
  }

  function toggleEnabled(medId: number) {
    setReminders(prev => {
      const current = prev[medId] ?? { enabled: false, time: '08:00' };
      return { ...prev, [medId]: { ...current, enabled: !current.enabled } };
    });
  }

  function setTime(medId: number, time: string) {
    setReminders(prev => {
      const current = prev[medId] ?? { enabled: true, time: '08:00' };
      return { ...prev, [medId]: { ...current, time } };
    });
    setPickerMedId(null);
  }

  async function handleContinue() {
    setSaving(true);
    try {
      const hasPermission = await requestNotificationPermission();

      for (const med of activeMeds) {
        const state = getReminderState(med.id);
        // Always save to backend (even disabled = persist the off state)
        await apiSetReminder(patientId, med.id, {
          reminder_time: state.time,
          enabled: state.enabled,
        });

        if (state.enabled && hasPermission) {
          await scheduleReminder(med.id, med.name, state.time);
        } else {
          await cancelReminder(med.id);
        }
      }
    } catch {
      Alert.alert('Error', 'Some reminders could not be saved. You can update them in Settings.');
    } finally {
      setSaving(false);
      navigation.navigate('MainTabs');
    }
  }

  async function handleSkip() {
    navigation.navigate('MainTabs');
  }

  function renderMedRow({ item }: { item: Medication }) {
    const state = getReminderState(item.id);
    const freq = formatFrequency(item.frequency_when, item.frequency_period);

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.medName}>{item.name}</Text>
            <Text style={styles.medDetail}>
              {item.dosage} {item.dosage_metric}
              {freq ? `  |  ${freq}` : ''}
            </Text>
          </View>
          <Switch
            value={state.enabled}
            onValueChange={() => toggleEnabled(item.id)}
            trackColor={{ false: Colors.BORDER, true: Colors.PRIMARY }}
            thumbColor={Colors.PRIMARY_TEXT}
            accessibilityLabel={`Toggle reminder for ${item.name}`}
          />
        </View>

        {state.enabled && (
          <TouchableOpacity
            style={styles.timeRow}
            onPress={() => setPickerMedId(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Change reminder time for ${item.name}`}
          >
            <Text style={styles.timeLabel}>Reminder at</Text>
            <Text style={styles.timeValue}>{formatTime12h(state.time)}</Text>
            <Text style={styles.timeChevron}>›</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const pickerMed = activeMeds.find(m => m.id === pickerMedId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>Step 4 of 5</Text>
        <Text style={styles.title}>Set Reminders</Text>
        <Text style={styles.subtitle}>
          Toggle on to get a daily notification for each medication.
        </Text>
      </View>

      {loadingExisting ? (
        <ActivityIndicator style={styles.loader} color={Colors.PRIMARY} />
      ) : activeMeds.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No active medications to set reminders for.</Text>
        </View>
      ) : (
        <FlatList
          data={activeMeds}
          keyExtractor={item => String(item.id)}
          renderItem={renderMedRow}
          contentContainerStyle={styles.list}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, saving && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.continueBtnText}>
            {saving ? 'Saving…' : 'Continue'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          accessibilityRole="button"
        >
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>
      </View>

      {/* Time Picker Modal */}
      <Modal
        visible={pickerMedId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerMedId(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerMedId(null)}
        >
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>
              Reminder time{pickerMed ? ` for ${pickerMed.name}` : ''}
            </Text>
            <ScrollView>
              {TIME_OPTIONS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.timeOption,
                    pickerMedId !== null && getReminderState(pickerMedId).time === t &&
                      styles.timeOptionSelected,
                  ]}
                  onPress={() => pickerMedId !== null && setTime(pickerMedId, t)}
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      pickerMedId !== null && getReminderState(pickerMedId).time === t &&
                        styles.timeOptionTextSelected,
                    ]}
                  >
                    {formatTime12h(t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.BACKGROUND },
  header: { padding: 24, paddingBottom: 8 },
  step: { fontSize: 13, color: Colors.TEXT_SECONDARY, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.TEXT_PRIMARY, marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.TEXT_SECONDARY },
  loader: { marginTop: 40 },
  list: { padding: 16 },
  card: {
    backgroundColor: Colors.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft: { flex: 1, marginRight: 12 },
  medName: { fontSize: 16, fontWeight: '700', color: Colors.TEXT_PRIMARY, marginBottom: 2 },
  medDetail: { fontSize: 13, color: Colors.TEXT_SECONDARY },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.BORDER,
  },
  timeLabel: { flex: 1, fontSize: 14, color: Colors.TEXT_SECONDARY },
  timeValue: { fontSize: 14, fontWeight: '700', color: Colors.PRIMARY },
  timeChevron: { fontSize: 20, color: Colors.PRIMARY, marginLeft: 6 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 16, color: Colors.TEXT_SECONDARY, textAlign: 'center' },
  footer: { padding: 24, paddingTop: 8, gap: 10 },
  continueBtn: {
    backgroundColor: Colors.PRIMARY,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: Colors.PRIMARY_TEXT },
  skipBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipBtnText: { fontSize: 15, color: Colors.TEXT_SECONDARY },
  btnDisabled: { backgroundColor: Colors.DISABLED },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Colors.SURFACE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '60%',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 16,
  },
  timeOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  timeOptionSelected: { backgroundColor: Colors.PRIMARY },
  timeOptionText: { fontSize: 16, color: Colors.TEXT_PRIMARY },
  timeOptionTextSelected: { color: Colors.PRIMARY_TEXT, fontWeight: '700' },
});
