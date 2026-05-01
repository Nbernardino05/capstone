// Mock react-native before the module under test loads it
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import {
  getMedications,
  confirmMedications,
  logDose,
  getTodayLogs,
  addMedication,
  updateMedication,
  deactivateMedication,
  getMedicationHistory,
  getReminders,
  setReminder,
} from '../src/api/medications';

const BASE = 'http://localhost:4000/api';

function mockFetch(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// getMedications (US 11)
describe('getMedications', () => {
  it('GETs /medications/:patientId and returns the parsed body', async () => {
    const meds = [{ id: 1, name: 'Metformin' }];
    mockFetch(200, meds);

    const result = await getMedications(1);

    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/medications/1`, expect.objectContaining({ headers: {} }));
    expect(result).toEqual(meds);
  });

  it('throws with the HTTP status on a non-OK response', async () => {
    mockFetch(500, { error: 'Database error' });
    await expect(getMedications(1)).rejects.toThrow('HTTP 500');
  });
});

// confirmMedications (US 11)
describe('confirmMedications', () => {
  it('PATCHes /medications/:patientId/confirm with the updates array', async () => {
    mockFetch(200, { success: true });
    const updates = [
      { id: 1, status: 'active' as const },
      { id: 2, status: 'inactive' as const },
    ];

    await confirmMedications(1, updates);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/medications/1/confirm`,
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ updates }),
      })
    );
  });

  it('throws on a non-OK response', async () => {
    mockFetch(400, { error: 'updates must be an array' });
    await expect(confirmMedications(1, [])).rejects.toThrow('HTTP 400');
  });
});

// logDose (US 14)
describe('logDose', () => {
  it('POSTs to /logs/:patientId/:medicationId and returns the created log', async () => {
    const log = { id: 1, patient_id: 1, medication_id: 3, logged_at: '2026-04-12T10:00:00Z' };
    mockFetch(201, log);

    const result = await logDose(1, 3);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/logs/1/3`,
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toEqual(log);
  });

  it('throws on a non-OK response', async () => {
    mockFetch(500, { error: 'Database error' });
    await expect(logDose(1, 3)).rejects.toThrow('HTTP 500');
  });
});

// getTodayLogs (US 14)
describe('getTodayLogs', () => {
  it("GETs /logs/:patientId/today and returns today's logs", async () => {
    const logs = [
      { id: 1, patient_id: 1, medication_id: 2, logged_at: '2026-04-12T08:00:00Z' },
    ];
    mockFetch(200, logs);

    const result = await getTodayLogs(1);

    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/logs/1/today`, expect.objectContaining({ headers: {} }));
    expect(result).toEqual(logs);
  });

  it('throws on a non-OK response', async () => {
    mockFetch(500, { error: 'Database error' });
    await expect(getTodayLogs(1)).rejects.toThrow('HTTP 500');
  });
});

// addMedication (US 12)
describe('addMedication', () => {
  it('POSTs to /medications/:patientId and returns the created record', async () => {
    const payload = {
      name: 'Vitamin C',
      dosage: '500',
      dosage_metric: 'mg',
      frequency_when: 'once',
      frequency_period: 'daily',
    };
    const created = { id: 5, patient_id: 1, source: 'patient', status: 'active', ...payload };
    mockFetch(201, created);

    const result = await addMedication(1, payload);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/medications/1`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      })
    );
    expect(result).toEqual(created);
  });

  it('throws on a non-OK response', async () => {
    mockFetch(400, { error: 'name, dosage, and dosage_metric are required' });
    await expect(
      addMedication(1, { name: '', dosage: '', dosage_metric: '', frequency_when: '', frequency_period: '' })
    ).rejects.toThrow('HTTP 400');
  });
});

// updateMedication (US 13)
describe('updateMedication', () => {
  it('PUTs to /medications/:patientId/:medicationId and returns the updated record', async () => {
    const payload = {
      name: 'Metformin',
      dosage: '1000',
      dosage_metric: 'mg',
      frequency_when: 'twice',
      frequency_period: 'daily',
    };
    const updated = { id: 2, patient_id: 1, source: 'provider', status: 'active', ...payload };
    mockFetch(200, updated);

    const result = await updateMedication(1, 2, payload);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/medications/1/2`,
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      })
    );
    expect(result).toEqual(updated);
  });

  it('throws with the HTTP status on a non-OK response', async () => {
    mockFetch(404, { error: 'Medication not found' });
    await expect(
      updateMedication(1, 99, { name: 'X', dosage: '1', dosage_metric: 'mg', frequency_when: 'once', frequency_period: 'daily' })
    ).rejects.toThrow('HTTP 404');
  });
});

// deactivateMedication (US 13)
describe('deactivateMedication', () => {
  it('PATCHes /medications/:patientId/:medicationId/deactivate', async () => {
    mockFetch(200, { success: true });

    await deactivateMedication(1, 2);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/medications/1/2/deactivate`,
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('throws with the HTTP status on a non-OK response', async () => {
    mockFetch(404, { error: 'Medication not found' });
    await expect(deactivateMedication(1, 99)).rejects.toThrow('HTTP 404');
  });
});

// getMedicationHistory (US 15)
describe('getMedicationHistory', () => {
  it('GETs /logs/:patientId/history?days=N and returns history logs', async () => {
    const logs = [
      {
        id: 1, medication_id: 2, medication_name: 'Metformin',
        dosage: '500', dosage_metric: 'mg',
        logged_at: '2026-04-12T08:00:00Z', log_date: '2026-04-12',
      },
    ];
    mockFetch(200, logs);

    const result = await getMedicationHistory(1, 7);

    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/logs/1/history?days=7`, expect.objectContaining({ headers: {} }));
    expect(result).toEqual(logs);
  });

  it('passes the days parameter in the query string', async () => {
    mockFetch(200, []);
    await getMedicationHistory(1, 30);
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/logs/1/history?days=30`, expect.objectContaining({ headers: {} }));
  });

  it('throws with the HTTP status on a non-OK response', async () => {
    mockFetch(400, { error: 'days must be between 1 and 365' });
    await expect(getMedicationHistory(1, 0)).rejects.toThrow('HTTP 400');
  });
});

// getReminders (US 16)
describe('getReminders', () => {
  it('GETs /reminders/:patientId and returns the reminders array', async () => {
    const reminders = [
      { id: 1, patient_id: 1, medication_id: 2, reminder_time: '08:00', enabled: 1 },
    ];
    mockFetch(200, reminders);

    const result = await getReminders(1);

    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/reminders/1`, expect.objectContaining({ headers: {} }));
    expect(result).toEqual(reminders);
  });

  it('throws with the HTTP status on a non-OK response', async () => {
    mockFetch(500, { error: 'Database error' });
    await expect(getReminders(1)).rejects.toThrow('HTTP 500');
  });
});

// setReminder (US 16)
describe('setReminder', () => {
  it('POSTs to /reminders/:patientId/:medicationId and returns the saved reminder', async () => {
    const payload = { reminder_time: '08:00', enabled: true };
    const saved = { id: 1, patient_id: 1, medication_id: 2, reminder_time: '08:00', enabled: 1 };
    mockFetch(201, saved);

    const result = await setReminder(1, 2, payload);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/reminders/1/2`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      })
    );
    expect(result).toEqual(saved);
  });

  it('throws with the HTTP status on a non-OK response', async () => {
    mockFetch(400, { error: 'reminder_time must be in HH:MM format' });
    await expect(setReminder(1, 2, { reminder_time: '8:00', enabled: true })).rejects.toThrow('HTTP 400');
  });
});
