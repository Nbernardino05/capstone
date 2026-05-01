import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Medication, MedicationStatus } from '../context/OnboardingContext';

export interface MedicationLog {
  id: number;
  patient_id: number;
  medication_id: number;
  logged_at: string; // ISO timestamp string from MySQL
}

export interface HistoryLog {
  id: number;
  medication_id: number;
  medication_name: string;
  dosage: string;
  dosage_metric: string;
  logged_at: string;
  log_date: string; // 'YYYY-MM-DD'
}

export interface Reminder {
  id: number;
  patient_id: number;
  medication_id: number;
  reminder_time: string; // 'HH:MM'
  enabled: number; // 0 | 1
}

const BASE_URL = `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:4000/api`;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// Medications
export async function getMedications(patientId: number): Promise<Medication[]> {
  const res = await fetch(`${BASE_URL}/medications/${patientId}`, {
    headers: await authHeaders(),
  });
  return handleResponse<Medication[]>(res);
}

export async function confirmMedications(
  patientId: number,
  updates: { id: number; status: MedicationStatus }[]
): Promise<void> {
  const res = await fetch(`${BASE_URL}/medications/${patientId}/confirm`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ updates }),
  });
  await handleResponse<{ success: boolean }>(res);
}

export async function addMedication(
  patientId: number,
  payload: {
    name: string;
    dosage: string;
    dosage_metric: string;
    frequency_when: string;
    frequency_period: string;
  }
): Promise<Medication> {
  const res = await fetch(`${BASE_URL}/medications/${patientId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  });
  return handleResponse<Medication>(res);
}

// US 13: Update a medication's details
export async function updateMedication(
  patientId: number,
  medicationId: number,
  payload: {
    name: string;
    dosage: string;
    dosage_metric: string;
    frequency_when: string;
    frequency_period: string;
  }
): Promise<Medication> {
  const res = await fetch(`${BASE_URL}/medications/${patientId}/${medicationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  });
  return handleResponse<Medication>(res);
}

// US 13: Deactivate (stop taking) a medication
export async function deactivateMedication(
  patientId: number,
  medicationId: number
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/medications/${patientId}/${medicationId}/deactivate`,
    { method: 'PATCH', headers: await authHeaders() }
  );
  await handleResponse<{ success: boolean }>(res);
}

// Dose Logs
export async function logDose(
  patientId: number,
  medicationId: number
): Promise<MedicationLog> {
  const res = await fetch(`${BASE_URL}/logs/${patientId}/${medicationId}`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  return handleResponse<MedicationLog>(res);
}

export async function getTodayLogs(patientId: number): Promise<MedicationLog[]> {
  const res = await fetch(`${BASE_URL}/logs/${patientId}/today`, {
    headers: await authHeaders(),
  });
  return handleResponse<MedicationLog[]>(res);
}

export interface HistoryResponse {
  logs: HistoryLog[];
  startDate: string | null; // earliest active medication creation date ('YYYY-MM-DD')
  adherencePercent: number;  // server-computed per-medication-per-day adherence
}

// US 15: Fetch history logs for a date range (days = 7 | 30)
export async function getMedicationHistory(
  patientId: number,
  days: number
): Promise<HistoryResponse> {
  const res = await fetch(`${BASE_URL}/logs/${patientId}/history?days=${days}`, {
    headers: await authHeaders(),
  });
  return handleResponse<HistoryResponse>(res);
}

// Reminders
export async function getReminders(patientId: number): Promise<Reminder[]> {
  const res = await fetch(`${BASE_URL}/reminders/${patientId}`, {
    headers: await authHeaders(),
  });
  return handleResponse<Reminder[]>(res);
}

export async function setReminder(
  patientId: number,
  medicationId: number,
  payload: { reminder_time: string; enabled: boolean }
): Promise<Reminder> {
  const res = await fetch(`${BASE_URL}/reminders/${patientId}/${medicationId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  });
  return handleResponse<Reminder>(res);
}
