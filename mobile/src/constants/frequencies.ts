export interface FrequencyOption {
  label: string;
  value: string;
}

export const FREQUENCY_WHEN_OPTIONS: FrequencyOption[] = [
  { label: 'Select', value: '' },
  { label: 'Once', value: 'once' },
  { label: 'Twice', value: 'twice' },
  { label: 'As needed', value: 'as_needed' },
];

export const FREQUENCY_PERIOD_OPTIONS: FrequencyOption[] = [
  { label: 'Select', value: '' },
  { label: 'Daily', value: 'daily' },
  { label: 'Morning', value: 'morning' },
  { label: 'Nightly', value: 'nightly' },
  { label: 'As needed', value: 'as_needed' },
];

export function formatFrequency(when: string, period: string): string {
  const whenLabels: Record<string, string> = {
    once: 'Once',
    twice: 'Twice',
    as_needed: 'As needed',
    custom: 'Custom',
  };
  const periodLabels: Record<string, string> = {
    daily: 'daily',
    morning: 'morning',
    nightly: 'nightly',
    as_needed: 'as needed',
  };
  const w = whenLabels[when] ?? when;
  const p = periodLabels[period] ?? period;
  if (!when && !period) return '';
  if (!period || period === when) return w;
  return `${w} / ${p}`;
}
