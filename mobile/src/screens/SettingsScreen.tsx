import React, { useState, useEffect, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { useOnboarding } from '../context/OnboardingContext';
import type { Medication } from '../context/OnboardingContext';
import { useAuth } from '../context/AuthContext';
import { setReminder as apiSetReminder, getReminders } from '../api/medications';
import {
  requestNotificationPermission,
  scheduleReminder,
  cancelReminder,
} from '../utils/reminders';
import { Colors } from '../constants/colors';

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

type ReminderState = { enabled: boolean; time: string };

export default function SettingsScreen() {
  const { patientId, medications } = useOnboarding();
  const { logout } = useAuth();
  const activeMeds = medications.filter(m => m.status === 'active');

  const [reminders, setReminders] = useState<Record<number, ReminderState>>({});
  const [pickerMedId, setPickerMedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const existing = await getReminders(patientId);
      const map: Record<number, ReminderState> = {};
      for (const r of existing) {
        map[r.medication_id] = { enabled: r.enabled === 1, time: r.reminder_time };
      }
      setReminders(map);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(useCallback(() => { fetchReminders(); }, [fetchReminders]));

  function getReminderState(medId: number): ReminderState {
    return reminders[medId] ?? { enabled: false, time: '08:00' };
  }

  async function saveReminder(medId: number, state: ReminderState) {
    setSaving(medId);
    try {
      const med = activeMeds.find(m => m.id === medId);
      if (!med) return;
      await apiSetReminder(patientId, medId, {
        reminder_time: state.time,
        enabled: state.enabled,
      });
      const hasPermission = await requestNotificationPermission();
      if (state.enabled && hasPermission) {
        await scheduleReminder(medId, med.name, state.time);
      } else {
        await cancelReminder(medId);
      }
    } catch {
      Alert.alert('Error', 'Could not update reminder. Please try again.');
    } finally {
      setSaving(null);
    }
  }

  async function toggleEnabled(medId: number) {
    const current = getReminderState(medId);
    const next = { ...current, enabled: !current.enabled };
    setReminders(prev => ({ ...prev, [medId]: next }));
    await saveReminder(medId, next);
  }

  function openTimePicker(medId: number) {
    setPickerMedId(medId);
  }

  async function selectTime(time: string) {
    if (pickerMedId === null) return;
    const next = { ...getReminderState(pickerMedId), time, enabled: true };
    setReminders(prev => ({ ...prev, [pickerMedId]: next }));
    setPickerMedId(null);
    await saveReminder(pickerMedId, next);
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  function renderReminderRow({ item }: { item: Medication }) {
    const state = getReminderState(item.id);
    const isSaving = saving === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.medName}>{item.name}</Text>
            <Text style={styles.medDetail}>
              {item.dosage} {item.dosage_metric}
            </Text>
          </View>
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.PRIMARY} />
          ) : (
            <Switch
              value={state.enabled}
              onValueChange={() => toggleEnabled(item.id)}
              trackColor={{ false: Colors.BORDER, true: Colors.PRIMARY }}
              thumbColor={Colors.PRIMARY_TEXT}
              accessibilityLabel={`Toggle reminder for ${item.name}`}
            />
          )}
        </View>

        {state.enabled && (
          <TouchableOpacity
            style={styles.timeRow}
            onPress={() => openTimePicker(item.id)}
            accessibilityRole="button"
          >
            <Text style={styles.timeLabel}>
              {state.enabled ? 'Reminder Set' : 'Set time'}
            </Text>
            <Text style={styles.timeValue}>{formatTime12h(state.time)}</Text>
            <Text style={styles.timeChevron}>›</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Text style={styles.sectionLabel}>Medication Reminders</Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={Colors.PRIMARY} />
      ) : activeMeds.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No active medications</Text>
        </View>
      ) : (
        <FlatList
          data={activeMeds}
          keyExtractor={item => String(item.id)}
          renderItem={renderReminderRow}
          contentContainerStyle={styles.list}
        />
      )}

      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} accessibilityRole="button">
          <Text style={styles.logoutText}>Sign Out</Text>
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
            <Text style={styles.pickerTitle}>Select reminder time</Text>
            <ScrollView>
              {TIME_OPTIONS.map(t => {
                const isSelected =
                  pickerMedId !== null && getReminderState(pickerMedId).time === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.timeOption, isSelected && styles.timeOptionSelected]}
                    onPress={() => selectTime(t)}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        isSelected && styles.timeOptionTextSelected,
                      ]}
                    >
                      {formatTime12h(t)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.BACKGROUND },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.BORDER,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.TEXT_PRIMARY },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.TEXT_SECONDARY,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingTop: 4 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 16, color: Colors.TEXT_SECONDARY },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: Colors.SURFACE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '60%',
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: Colors.TEXT_PRIMARY, marginBottom: 16 },
  timeOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  timeOptionSelected: { backgroundColor: Colors.PRIMARY },
  timeOptionText: { fontSize: 16, color: Colors.TEXT_PRIMARY },
  timeOptionTextSelected: { color: Colors.PRIMARY_TEXT, fontWeight: '700' },
  logoutSection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.BORDER,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: Colors.ERROR,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: Colors.ERROR },
});
