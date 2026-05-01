import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOnboarding } from '../context/OnboardingContext';
import type { Medication } from '../context/OnboardingContext';
import { deactivateMedication as apiDeactivate } from '../api/medications';
import { Colors } from '../constants/colors';
import { formatFrequency } from '../constants/frequencies';
import type { RootStackParamList } from '../navigation/AppNavigator';

type MedsNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function MedsScreen() {
  const navigation = useNavigation<MedsNavProp>();
  const { patientId, medications, deactivateMedication } = useOnboarding();

  const activeMeds = medications.filter(m => m.status === 'active');
  const inactiveMeds = medications.filter(m => m.status === 'inactive');

  const [deactivating, setDeactivating] = useState<number | null>(null);

  function handleEdit(med: Medication) {
    navigation.navigate('EditMedication', { medication: med });
  }

  function confirmStopTaking(med: Medication) {
    Alert.alert(
      'Stop taking medication?',
      `Are you sure you want to stop taking ${med.name}? Your dose history will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop taking',
          style: 'destructive',
          onPress: () => handleStopTaking(med),
        },
      ]
    );
  }

  async function handleStopTaking(med: Medication) {
    setDeactivating(med.id);
    try {
      await apiDeactivate(patientId, med.id);
      deactivateMedication(med.id);
    } catch {
      Alert.alert('Error', 'Could not update medication. Please try again.');
    } finally {
      setDeactivating(null);
    }
  }

  function renderActiveMed({ item }: { item: Medication }) {
    const isDeactivating = deactivating === item.id;
    const freq = formatFrequency(item.frequency_when, item.frequency_period);

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.medName}>{item.name}</Text>
          <Text style={styles.medDetail}>
            {item.dosage} {item.dosage_metric}
            {freq ? `  |  ${freq}` : ''}
          </Text>
          {item.source === 'provider' && (
            <Text style={styles.sourceTag}>Provider-added</Text>
          )}
        </View>
        <View style={styles.actionCol}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => handleEdit(item)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.stopBtn, isDeactivating && styles.btnDisabled]}
            onPress={() => confirmStopTaking(item)}
            disabled={isDeactivating}
            accessibilityRole="button"
            accessibilityLabel={`Stop taking ${item.name}`}
          >
            <Text style={styles.stopBtnText}>
              {isDeactivating ? '…' : 'Stop taking'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderInactiveMed({ item }: { item: Medication }) {
    const freq = formatFrequency(item.frequency_when, item.frequency_period);
    return (
      <View style={[styles.card, styles.cardInactive]}>
        <View style={styles.cardLeft}>
          <Text style={[styles.medName, styles.inactiveText]}>{item.name}</Text>
          <Text style={[styles.medDetail, styles.inactiveText]}>
            {item.dosage} {item.dosage_metric}
            {freq ? `  |  ${freq}` : ''}
          </Text>
          <Text style={styles.inactiveTag}>Stopped</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Medications</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddMissingMedication')}
          accessibilityRole="button"
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => 'placeholder'}
        renderItem={null}
        ListHeaderComponent={
          <>
            {activeMeds.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Active</Text>
                {activeMeds.map(med => <View key={med.id}>{renderActiveMed({ item: med })}</View>)}
              </>
            )}

            {activeMeds.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No active medications</Text>
              </View>
            )}

            {inactiveMeds.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, styles.sectionLabelInactive]}>
                  Stopped
                </Text>
                {inactiveMeds.map(med => <View key={med.id}>{renderInactiveMed({ item: med })}</View>)}
              </>
            )}
          </>
        }
        contentContainerStyle={styles.list}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.TEXT_PRIMARY },
  list: { padding: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.TEXT_SECONDARY,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionLabelInactive: { marginTop: 24 },
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
  cardInactive: { opacity: 0.6 },
  cardLeft: { flex: 1, marginRight: 12 },
  medName: { fontSize: 16, fontWeight: '700', color: Colors.TEXT_PRIMARY, marginBottom: 4 },
  medDetail: { fontSize: 13, color: Colors.TEXT_SECONDARY },
  sourceTag: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.TEXT_SECONDARY,
    fontStyle: 'italic',
  },
  inactiveText: { color: Colors.DISABLED },
  inactiveTag: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.DISABLED,
    fontWeight: '600',
  },
  actionCol: { gap: 8 },
  editBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.OUTLINE_BUTTON_BORDER,
    alignItems: 'center',
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: Colors.OUTLINE_BUTTON_TEXT },
  stopBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.TOGGLE_INACTIVE_BORDER,
    backgroundColor: Colors.TOGGLE_INACTIVE_BG,
    alignItems: 'center',
  },
  stopBtnText: { fontSize: 13, fontWeight: '600', color: Colors.TOGGLE_INACTIVE_TEXT },
  btnDisabled: { opacity: 0.5 },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  emptyText: { fontSize: 16, color: Colors.TEXT_SECONDARY },
  addBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.OUTLINE_BUTTON_BORDER,
  },
  addBtnText: { fontSize: 13, fontWeight: '600', color: Colors.OUTLINE_BUTTON_TEXT },
});
