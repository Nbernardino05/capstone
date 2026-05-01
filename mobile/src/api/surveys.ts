import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SurveyResponse {
  id: number;
  medication_id: number;
  medication_name: string;
  efficacy_rating: number; // 1–5
  side_effects: string | null;
}

export interface Survey {
  id: number;
  patient_id: number;
  survey_date: string;
  submitted_at: string;
  updated_at: string;
  responses: SurveyResponse[];
}

export interface SurveyResponsePayload {
  medication_id: number;
  medication_name: string;
  efficacy_rating: number;
  side_effects?: string;
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

// Get today's survey (returns null if not yet submitted)
export async function getTodaySurvey(patientId: number): Promise<Survey | null> {
  const res = await fetch(`${BASE_URL}/surveys/${patientId}/today`, {
    headers: await authHeaders(),
  });
  return handleResponse<Survey | null>(res);
}

// Submit (or overwrite) today's survey
export async function submitSurvey(
  patientId: number,
  responses: SurveyResponsePayload[]
): Promise<Survey> {
  const res = await fetch(`${BASE_URL}/surveys/${patientId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ responses }),
  });
  return handleResponse<Survey>(res);
}
