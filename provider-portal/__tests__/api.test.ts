/**
 * @jest-environment jsdom
 */

import {
  clinicianLogin,
  clinicianRegister,
  listPatients,
  getPatient,
  getAdherence,
  getSurveys,
  sendInvitation,
} from '../src/lib/api';

const BASE = 'http://localhost:4000/api';

function mockFetch(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

// clinicianLogin
describe('clinicianLogin', () => {
  it('POSTs to /auth/clinician/login with email and password', async () => {
    const payload = { token: 'tok', clinician: { id: 1, name: 'Dr. Smith', email: 'doc@hospital.com', practice: null } };
    mockFetch(200, payload);

    await clinicianLogin('doc@hospital.com', 'secret');

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/auth/clinician/login`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'doc@hospital.com', password: 'secret' }),
      }),
    );
  });

  it('returns token and clinician on success', async () => {
    const payload = { token: 'tok123', clinician: { id: 2, name: 'Dr. Lee', email: 'lee@clinic.com', practice: 'Cardiology' } };
    mockFetch(200, payload);

    const result = await clinicianLogin('lee@clinic.com', 'pass');

    expect(result.token).toBe('tok123');
    expect(result.clinician.name).toBe('Dr. Lee');
  });

  it('throws with the server error message on a failed login', async () => {
    mockFetch(401, { error: 'Invalid credentials' });

    await expect(clinicianLogin('bad@email.com', 'wrong')).rejects.toThrow('Invalid credentials');
  });
});

// clinicianRegister
describe('clinicianRegister', () => {
  it('POSTs to /auth/clinician/register with name, email and password', async () => {
    mockFetch(201, { token: 'tok', clinician: { id: 3, name: 'Dr. Kim', email: 'kim@hospital.com', practice: null } });

    await clinicianRegister('Dr. Kim', 'kim@hospital.com', 'pw');

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/auth/clinician/register`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Dr. Kim', email: 'kim@hospital.com', password: 'pw' }),
      }),
    );
  });
});

// listPatients
describe('listPatients', () => {
  it('GETs /clinician/patients and sends the stored Authorization token', async () => {
    localStorage.setItem('clinician_token', 'my-jwt');
    mockFetch(200, [{ id: 1, name: 'Alice', email: 'alice@email.com', created_at: '2026-01-01' }]);

    const result = await listPatients();

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/clinician/patients`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-jwt' }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });

  it('throws on a 401 Unauthorized response', async () => {
    mockFetch(401, { error: 'Unauthorized' });
    await expect(listPatients()).rejects.toThrow('Unauthorized');
  });
});

// getAdherence
describe('getAdherence', () => {
  it('GETs /clinician/patients/:id/adherence with the days query parameter', async () => {
    const data = { medications: [], logs: [], adherencePercent: 80, days: 30 };
    mockFetch(200, data);

    await getAdherence(5, 30);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/clinician/patients/5/adherence?days=30`,
      expect.any(Object),
    );
  });

  it('returns the adherence data object', async () => {
    const data = { medications: [{ id: 1, name: 'Aspirin' }], logs: [], adherencePercent: 75, days: 7 };
    mockFetch(200, data);

    const result = await getAdherence(5, 7);

    expect(result.adherencePercent).toBe(75);
    expect(result.medications).toHaveLength(1);
  });
});

// getSurveys
describe('getSurveys', () => {
  it('GETs /clinician/patients/:id/surveys with the days query parameter', async () => {
    mockFetch(200, []);

    await getSurveys(3, 7);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/clinician/patients/3/surveys?days=7`,
      expect.any(Object),
    );
  });
});

// sendInvitation
describe('sendInvitation', () => {
  it('POSTs patient info and medications to /clinician/invite', async () => {
    const invitation = { id: 1, code: 'ABC123', expires_at: '2026-05-01', patient_name: 'Bob', patient_email: 'bob@example.com' };
    mockFetch(201, { invitation });

    const meds = [{ name: 'Aspirin', dosage: '81', dosage_metric: 'mg', frequency_when: 'once', frequency_period: 'daily' }];
    const result = await sendInvitation('Bob', 'bob@example.com', meds);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/clinician/invite`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ patient_name: 'Bob', patient_email: 'bob@example.com', medications: meds }),
      }),
    );
    expect(result.invitation.code).toBe('ABC123');
  });
});
