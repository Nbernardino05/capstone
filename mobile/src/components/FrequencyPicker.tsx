import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native';
import type { FrequencyOption } from '../constants/frequencies';
import { Colors } from '../constants/colors';

interface FrequencyPickerProps {
  label: string;
  options: FrequencyOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export default function FrequencyPicker({
  label,
  options,
  selectedValue,
  onSelect,
}: FrequencyPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    options.find(o => o.value === selectedValue)?.label ?? 'Select';
  const hasValue = selectedValue !== '';

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedLabel}`}
      >
        <Text style={[styles.triggerText, !hasValue && styles.placeholder]}>
          {selectedLabel}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Backdrop — tap outside to close */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Stop touch propagation inside the sheet */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={item => item.value || '__empty__'}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === selectedValue && styles.optionSelected,
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item.value === selectedValue && styles.optionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.TEXT_SECONDARY,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.SURFACE,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  triggerText: {
    fontSize: 15,
    color: Colors.TEXT_PRIMARY,
    flex: 1,
  },
  placeholder: {
    color: Colors.TEXT_SECONDARY,
  },
  chevron: {
    fontSize: 12,
    color: Colors.TEXT_SECONDARY,
    marginLeft: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  sheet: {
    backgroundColor: Colors.SURFACE,
    borderRadius: 14,
    paddingVertical: 8,
    width: '100%',
    maxHeight: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.TEXT_SECONDARY,
    textAlign: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.BORDER,
    marginBottom: 4,
  },
  option: {
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  optionSelected: {
    backgroundColor: Colors.TOGGLE_ACTIVE_BG,
  },
  optionText: {
    fontSize: 16,
    color: Colors.TEXT_PRIMARY,
  },
  optionTextSelected: {
    color: Colors.TOGGLE_ACTIVE_TEXT,
    fontWeight: '600',
  },
});
