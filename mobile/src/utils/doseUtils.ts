import type { Medication } from '../context/OnboardingContext';
import type { MedicationLog } from '../api/medications';

export function isAsNeeded(med: Medication): boolean {
  return med.frequency_when === 'as_needed' || med.frequency_period === 'as_needed';
}

export function isWithin30Min(isoString: string): boolean {
  const logged = new Date(isoString).getTime();
  const now = Date.now();
  return now - logged < 30 * 60 * 1000;
}

export function getMostRecentLog(
  logs: MedicationLog[],
  medicationId: number
): MedicationLog | undefined {
  const medLogs = logs.filter(l => l.medication_id === medicationId);
  return medLogs[medLogs.length - 1];
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
