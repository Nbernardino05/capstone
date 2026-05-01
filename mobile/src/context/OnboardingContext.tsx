import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getMedications } from '../api/medications';

export type MedicationStatus = 'active' | 'inactive';
export type MedicationSource = 'provider' | 'patient';

export interface Medication {
  id: number;
  patient_id: number;
  name: string;
  dosage: string;
  dosage_metric: string;
  frequency_when: string;
  frequency_period: string;
  source: MedicationSource;
  status: MedicationStatus;
}

interface OnboardingContextType {
  patientId: number;
  medications: Medication[];
  setMedications: (meds: Medication[]) => void;
  toggleMedicationStatus: (id: number, status: MedicationStatus) => void;
  addMedication: (med: Medication) => void;
  updateMedication: (updated: Medication) => void;
  deactivateMedication: (id: number) => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { patient } = useAuth();
  const [medications, setMedicationsState] = useState<Medication[]>([]);

  // Use real patient id from auth; fall back to 1 only during development/tests
  const patientId = patient?.id ?? 1;

  useEffect(() => {
    if (!patient?.id) {
      setMedicationsState([]);
      return;
    }
    getMedications(patient.id).then(setMedicationsState).catch(() => {});
  }, [patient?.id]);

  function setMedications(meds: Medication[]) {
    setMedicationsState(meds);
  }

  function toggleMedicationStatus(id: number, status: MedicationStatus) {
    setMedicationsState(prev =>
      prev.map(med => (med.id === id ? { ...med, status } : med))
    );
  }

  function addMedication(med: Medication) {
    setMedicationsState(prev => [...prev, med]);
  }

  function updateMedication(updated: Medication) {
    setMedicationsState(prev =>
      prev.map(med => (med.id === updated.id ? updated : med))
    );
  }

  function deactivateMedication(id: number) {
    setMedicationsState(prev =>
      prev.map(med => (med.id === id ? { ...med, status: 'inactive' } : med))
    );
  }

  return (
    <OnboardingContext.Provider
      value={{
        patientId,
        medications,
        setMedications,
        toggleMedicationStatus,
        addMedication,
        updateMedication,
        deactivateMedication,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextType {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
