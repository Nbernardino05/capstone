import { isAsNeeded, isWithin30Min, getMostRecentLog } from '../src/utils/doseUtils';
import type { Medication } from '../src/context/OnboardingContext';
import type { MedicationLog } from '../src/api/medications';

const baseMed: Medication = {
  id: 1,
  patient_id: 1,
  name: 'Metformin',
  dosage: '500',
  dosage_metric: 'mg',
  frequency_when: 'once',
  frequency_period: 'daily',
  source: 'provider',
  status: 'active',
};

// isAsNeeded
describe('isAsNeeded', () => {
  it('returns false for a scheduled medication', () => {
    expect(isAsNeeded(baseMed)).toBe(false);
  });

  it('returns true when frequency_when is as_needed', () => {
    expect(isAsNeeded({ ...baseMed, frequency_when: 'as_needed' })).toBe(true);
  });

  it('returns true when frequency_period is as_needed', () => {
    expect(isAsNeeded({ ...baseMed, frequency_period: 'as_needed' })).toBe(true);
  });

  it('returns false for once/daily frequency', () => {
    expect(isAsNeeded({ ...baseMed, frequency_when: 'once', frequency_period: 'daily' })).toBe(false);
  });
});

// isWithin30Min
describe('isWithin30Min', () => {
  it('returns true for a timestamp 5 minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(isWithin30Min(fiveMinAgo)).toBe(true);
  });

  it('returns true for a timestamp 29 minutes ago', () => {
    const twentyNineMinAgo = new Date(Date.now() - 29 * 60 * 1000).toISOString();
    expect(isWithin30Min(twentyNineMinAgo)).toBe(true);
  });

  it('returns false for a timestamp 31 minutes ago', () => {
    const thirtyOneMinAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    expect(isWithin30Min(thirtyOneMinAgo)).toBe(false);
  });

  it('returns false for a timestamp 1 hour ago', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(isWithin30Min(oneHourAgo)).toBe(false);
  });
});

// getMostRecentLog
describe('getMostRecentLog', () => {
  const logs: MedicationLog[] = [
    { id: 1, patient_id: 1, medication_id: 10, logged_at: '2026-04-12T08:00:00Z' },
    { id: 2, patient_id: 1, medication_id: 10, logged_at: '2026-04-12T10:00:00Z' },
    { id: 3, patient_id: 1, medication_id: 20, logged_at: '2026-04-12T09:00:00Z' },
  ];

  it('returns the last log entry for a given medication', () => {
    const result = getMostRecentLog(logs, 10);
    expect(result?.id).toBe(2);
  });

  it('returns undefined when no logs exist for the medication', () => {
    const result = getMostRecentLog(logs, 99);
    expect(result).toBeUndefined();
  });

  it('returns the single log when only one exists for the medication', () => {
    const result = getMostRecentLog(logs, 20);
    expect(result?.id).toBe(3);
  });

  it('returns undefined for an empty logs array', () => {
    const result = getMostRecentLog([], 10);
    expect(result).toBeUndefined();
  });
});
