import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface PatientUser {
  id: number;
  name: string;
  email: string;
}

interface AuthContextType {
  token: string | null;
  patient: PatientUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (invitationCode: string, email: string, password: string) => Promise<PatientUser>;
  validateInviteCode: (code: string) => Promise<{ patient_name: string; patient_email: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const BASE_URL = `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:4000/api`;

async function apiPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Clear any persisted session on startup so each app launch requires fresh login
    AsyncStorage.multiRemove(['auth_token', 'patient_data'])
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const data = await apiPost<{ token: string; patient: PatientUser }>(
      '/auth/patient/login',
      { email, password }
    );
    await AsyncStorage.multiSet([
      ['auth_token', data.token],
      ['patient_data', JSON.stringify(data.patient)],
    ]);
    setToken(data.token);
    setPatient(data.patient);
  }

  async function register(invitationCode: string, email: string, password: string): Promise<PatientUser> {
    const data = await apiPost<{ token: string; patient: PatientUser }>(
      '/auth/patient/register',
      { invitation_code: invitationCode, email, password }
    );
    await AsyncStorage.multiSet([
      ['auth_token', data.token],
      ['patient_data', JSON.stringify(data.patient)],
    ]);
    setToken(data.token);
    setPatient(data.patient);
    return data.patient;
  }

  async function validateInviteCode(code: string): Promise<{ patient_name: string; patient_email: string }> {
    const res = await fetch(`${BASE_URL}/invitations/${encodeURIComponent(code.toUpperCase())}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid invitation code');
    return data;
  }

  async function logout() {
    await AsyncStorage.multiRemove(['auth_token', 'patient_data']);
    setToken(null);
    setPatient(null);
  }

  return (
    <AuthContext.Provider value={{ token, patient, isLoading, login, register, validateInviteCode, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
