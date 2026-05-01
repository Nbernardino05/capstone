import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import {
  OnboardingProvider,
  useOnboarding,
} from '../src/context/OnboardingContext';
import type { Medication } from '../src/context/OnboardingContext';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ patient: null }),
}));

jest.mock('../src/api/medications', () => ({
  getMedications: jest.fn().mockResolvedValue([]),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <OnboardingProvider>{children}</OnboardingProvider>
);

function makeMed(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 1,
    patient_id: 1,
    name: 'Metformin',
    dosage: '500',
    dosage_metric: 'mg',
    frequency_when: 'once',
    frequency_period: 'daily',
    source: 'provider',
    status: 'active',
    ...overrides,
  };
}

describe('OnboardingContext', () => {
  it('throws when used outside OnboardingProvider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useOnboarding())).toThrow(
      'useOnboarding must be used within OnboardingProvider'
    );
  });

  it('starts with an empty medications list', () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    expect(result.current.medications).toEqual([]);
  });

  it('exposes patientId of 1', () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    expect(result.current.patientId).toBe(1);
  });

  // setMedications
  describe('setMedications', () => {
    it('replaces the entire medications list', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });
      const meds = [makeMed({ id: 1 }), makeMed({ id: 2, name: 'Aspirin' })];

      act(() => { result.current.setMedications(meds); });

      expect(result.current.medications).toEqual(meds);
    });

    it('can be called with an empty array to clear medications', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });
      act(() => { result.current.setMedications([makeMed()]); });
      act(() => { result.current.setMedications([]); });

      expect(result.current.medications).toEqual([]);
    });
  });

  // toggleMedicationStatus
  describe('toggleMedicationStatus', () => {
    it('sets the targeted medication to inactive', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });
      act(() => { result.current.setMedications([makeMed({ id: 1, status: 'active' })]); });

      act(() => { result.current.toggleMedicationStatus(1, 'inactive'); });

      expect(result.current.medications[0].status).toBe('inactive');
    });

    it('sets the targeted medication back to active', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });
      act(() => { result.current.setMedications([makeMed({ id: 1, status: 'inactive' })]); });

      act(() => { result.current.toggleMedicationStatus(1, 'active'); });

      expect(result.current.medications[0].status).toBe('active');
    });

    it('does not affect other medications in the list', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });
      act(() => {
        result.current.setMedications([
          makeMed({ id: 1, status: 'active' }),
          makeMed({ id: 2, name: 'Aspirin', status: 'active' }),
        ]);
      });

      act(() => { result.current.toggleMedicationStatus(1, 'inactive'); });

      expect(result.current.medications[1].status).toBe('active');
    });

    it('leaves the list unchanged when the id does not match any medication', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });
      const meds = [makeMed({ id: 1, status: 'active' })];
      act(() => { result.current.setMedications(meds); });

      act(() => { result.current.toggleMedicationStatus(999, 'inactive'); });

      expect(result.current.medications[0].status).toBe('active');
    });
  });

  // addMedication
  describe('addMedication', () => {
    it('appends a new medication to the list', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });
      const med = makeMed({ id: 10, name: 'Vitamin D', source: 'patient' });

      act(() => { result.current.addMedication(med); });

      expect(result.current.medications).toHaveLength(1);
      expect(result.current.medications[0]).toEqual(med);
    });

    it('preserves existing medications when adding a new one', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });
      act(() => { result.current.setMedications([makeMed({ id: 1 })]); });

      act(() => { result.current.addMedication(makeMed({ id: 2, name: 'Vitamin D' })); });

      expect(result.current.medications).toHaveLength(2);
      expect(result.current.medications[1].name).toBe('Vitamin D');
    });
  });
});
