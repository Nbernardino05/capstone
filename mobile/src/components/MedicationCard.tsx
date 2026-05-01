import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type {
  Medication,
  MedicationStatus,
} from "../context/OnboardingContext";
import { Colors } from "../constants/colors";
import { formatFrequency } from "../constants/frequencies";

interface MedicationCardProps {
  medication: Medication;
  onToggle: ((status: MedicationStatus) => void) | null;
}

export default function MedicationCard({
  medication,
  onToggle,
}: MedicationCardProps) {
  const {
    name,
    dosage,
    dosage_metric,
    frequency_when,
    frequency_period,
    status,
  } = medication;
  const frequencyLabel = formatFrequency(frequency_when, frequency_period);

  const isActive = status === "active";

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.detail}>
        {dosage} {dosage_metric}
        {frequencyLabel ? `  |  ${frequencyLabel}` : ""}
      </Text>

      {onToggle !== null ? (
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, isActive && styles.activeBtn]}
            onPress={() => onToggle("active")}
            accessibilityRole="button"
            accessibilityLabel="Still taking"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.toggleText, isActive && styles.activeText]}>
              Still taking
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, !isActive && styles.inactiveBtn]}
            onPress={() => onToggle("inactive")}
            accessibilityRole="button"
            accessibilityLabel="Stopped"
            accessibilityState={{ selected: !isActive }}
          >
            <Text style={[styles.toggleText, !isActive && styles.inactiveText]}>
              Stopped
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Patient-added medication — always active, show badge
        <View style={styles.toggleRow}>
          <View style={[styles.toggleBtn, styles.activeBtn]}>
            <Text style={[styles.toggleText, styles.activeText]}>
              Still taking
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    padding: 16,
    marginBottom: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.TEXT_PRIMARY,
    marginBottom: 4,
  },
  detail: {
    fontSize: 13,
    color: Colors.TEXT_SECONDARY,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    backgroundColor: Colors.SURFACE,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.TEXT_SECONDARY,
  },
  activeBtn: {
    backgroundColor: Colors.TOGGLE_ACTIVE_BG,
    borderColor: Colors.TOGGLE_ACTIVE_BORDER,
  },
  activeText: {
    color: Colors.TOGGLE_ACTIVE_TEXT,
  },
  inactiveBtn: {
    backgroundColor: Colors.TOGGLE_INACTIVE_BG,
    borderColor: Colors.TOGGLE_INACTIVE_BORDER,
  },
  inactiveText: {
    color: Colors.TOGGLE_INACTIVE_TEXT,
  },
});
