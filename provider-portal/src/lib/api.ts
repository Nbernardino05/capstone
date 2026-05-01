const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api`;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('clinician_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export interface Clinician {
  id: number;
  name: string;
  email: string;
  practice: string | null;
}

export interface Patient {
  id: number;
  name: string;
  email: string | null;
  created_at: string;
}

export interface InvitationMedication {
  name: string;
  dosage: string;
  dosage_metric: string;
  frequency_when: string;
  frequency_period: string;
}

export interface SurveyRow {
  survey_date: string;
  medication_id: number;
  medication_name: string;
  efficacy_rating: number;
  side_effects: string;
}

export interface AdherenceLog {
  medication_id: number;
  log_date: string;
  dose_count: number;
}

export interface AdherenceData {
  medications: { id: number; name: string; created_date: string }[];
  logs: AdherenceLog[];
  adherencePercent: number;
  days: number;
}

// Auth
export async function clinicianRegister(
  name: string,
  email: string,
  password: string
): Promise<{ token: string; clinician: Clinician }> {
  return request('/auth/clinician/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export async function clinicianLogin(
  email: string,
  password: string
): Promise<{ token: string; clinician: Clinician }> {
  return request('/auth/clinician/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// Patients
export async function listPatients(): Promise<Patient[]> {
  return request('/clinician/patients');
}

export async function getPatient(patientId: number): Promise<{
  patient: Patient;
  medications: {
    id: number;
    name: string;
    dosage: string;
    dosage_metric: string;
    frequency_when: string;
    frequency_period: string;
    status: string;
  }[];
}> {
  return request(`/clinician/patients/${patientId}`);
}

export async function getAdherence(patientId: number, days: number): Promise<AdherenceData> {
  return request(`/clinician/patients/${patientId}/adherence?days=${days}`);
}

export async function getSurveys(patientId: number, days: number): Promise<SurveyRow[]> {
  return request(`/clinician/patients/${patientId}/surveys?days=${days}`);
}

// Invitations
export async function sendInvitation(
  patient_name: string,
  patient_email: string,
  medications: InvitationMedication[]
): Promise<{ invitation: { id: number; code: string; expires_at: string; patient_name: string; patient_email: string } }> {
  return request('/clinician/invite', {
    method: 'POST',
    body: JSON.stringify({ patient_name, patient_email, medications }),
  });
}
