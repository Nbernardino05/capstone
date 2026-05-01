const request = require('supertest');
const express = require('express');

jest.mock('../db');
const db = require('../db');

jest.mock('../middleware/auth', () => ({
  requirePatient: (req, _res, next) => { req.patientId = 1; next(); },
  requireClinician: (_req, _res, next) => next(),
}));

const router = require('../routes/medications');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  return app;
}

function mockConnection(overrides = {}) {
  const conn = {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([{}]),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
    ...overrides,
  };
  db.getConnection.mockResolvedValue(conn);
  return conn;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// US 11: Fetch medications
describe('GET /api/medications/:patientId', () => {
  it('returns all medications for the patient', async () => {
    const meds = [
      { id: 1, patient_id: 1, name: 'Metformin', source: 'provider', status: 'active' },
      { id: 2, patient_id: 1, name: 'Vitamin D', source: 'patient', status: 'active' },
    ];
    db.query.mockResolvedValueOnce([meds]);

    const res = await request(buildApp()).get('/api/medications/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(meds);
  });

  it('returns an empty array when the patient has no medications', async () => {
    db.query.mockResolvedValueOnce([[]]);

    const res = await request(buildApp()).get('/api/medications/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('connection lost'));

    const res = await request(buildApp()).get('/api/medications/1');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });
});

// US 11: Confirm medications
describe('PATCH /api/medications/:patientId/confirm', () => {
  it('returns 400 when updates is not an array', async () => {
    const res = await request(buildApp())
      .patch('/api/medications/1/confirm')
      .send({ updates: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'updates must be an array' });
  });

  it('returns 400 when a status value is not active or inactive', async () => {
    mockConnection();

    const res = await request(buildApp())
      .patch('/api/medications/1/confirm')
      .send({ updates: [{ id: 1, status: 'unknown' }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid status value/);
  });

  it('rolls back the transaction when a status value is invalid', async () => {
    const conn = mockConnection();

    await request(buildApp())
      .patch('/api/medications/1/confirm')
      .send({ updates: [{ id: 1, status: 'unknown' }] });

    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  it('updates each medication status and returns success', async () => {
    const conn = mockConnection();
    const updates = [
      { id: 1, status: 'active' },
      { id: 2, status: 'inactive' },
    ];

    const res = await request(buildApp())
      .patch('/api/medications/1/confirm')
      .send({ updates });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(conn.query).toHaveBeenCalledTimes(2);
    expect(conn.commit).toHaveBeenCalled();
  });

  it('accepts an empty updates array (no-op) and returns success', async () => {
    mockConnection();

    const res = await request(buildApp())
      .patch('/api/medications/1/confirm')
      .send({ updates: [] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('returns 500 and rolls back on database error', async () => {
    const conn = mockConnection({
      query: jest.fn().mockRejectedValueOnce(new Error('DB error')),
    });

    const res = await request(buildApp())
      .patch('/api/medications/1/confirm')
      .send({ updates: [{ id: 1, status: 'active' }] });

    expect(res.status).toBe(500);
    expect(conn.rollback).toHaveBeenCalled();
  });
});

// US 12: Add patient medication
describe('POST /api/medications/:patientId', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(buildApp())
      .post('/api/medications/1')
      .send({ dosage: '500', dosage_metric: 'mg' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'name, dosage, and dosage_metric are required' });
  });

  it('returns 400 when dosage is missing', async () => {
    const res = await request(buildApp())
      .post('/api/medications/1')
      .send({ name: 'Vitamin C', dosage_metric: 'mg' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'name, dosage, and dosage_metric are required' });
  });

  it('returns 400 when dosage_metric is missing', async () => {
    const res = await request(buildApp())
      .post('/api/medications/1')
      .send({ name: 'Vitamin C', dosage: '500' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'name, dosage, and dosage_metric are required' });
  });

  it('creates the medication with source=patient and status=active (enforced server-side)', async () => {
    const inserted = {
      id: 5,
      patient_id: 1,
      name: 'Vitamin C',
      dosage: '500',
      dosage_metric: 'mg',
      frequency_when: 'once',
      frequency_period: 'daily',
      source: 'patient',
      status: 'active',
    };
    db.query
      .mockResolvedValueOnce([{ insertId: 5 }])
      .mockResolvedValueOnce([[inserted]]);

    const res = await request(buildApp())
      .post('/api/medications/1')
      .send({ name: 'Vitamin C', dosage: '500', dosage_metric: 'mg' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(inserted);
    // Confirm source and status are hardcoded in the SQL, not taken from the body
    const insertSql = db.query.mock.calls[0][0];
    expect(insertSql).toContain("'patient'");
    expect(insertSql).toContain("'active'");
  });

  it('defaults frequency_when to once and frequency_period to daily when omitted', async () => {
    const inserted = {
      id: 6, patient_id: 1, name: 'Aspirin', dosage: '81', dosage_metric: 'mg',
      frequency_when: 'once', frequency_period: 'daily', source: 'patient', status: 'active',
    };
    db.query
      .mockResolvedValueOnce([{ insertId: 6 }])
      .mockResolvedValueOnce([[inserted]]);

    await request(buildApp())
      .post('/api/medications/1')
      .send({ name: 'Aspirin', dosage: '81', dosage_metric: 'mg' });

    const insertParams = db.query.mock.calls[0][1];
    expect(insertParams[4]).toBe('once');   // frequency_when
    expect(insertParams[5]).toBe('daily');  // frequency_period
  });

  it('trims whitespace from name, dosage, and dosage_metric', async () => {
    const inserted = {
      id: 7, patient_id: 1, name: 'Fish Oil', dosage: '1000', dosage_metric: 'mg',
      frequency_when: 'once', frequency_period: 'daily', source: 'patient', status: 'active',
    };
    db.query
      .mockResolvedValueOnce([{ insertId: 7 }])
      .mockResolvedValueOnce([[inserted]]);

    await request(buildApp())
      .post('/api/medications/1')
      .send({ name: '  Fish Oil  ', dosage: ' 1000 ', dosage_metric: ' mg ' });

    const insertParams = db.query.mock.calls[0][1];
    expect(insertParams[1]).toBe('Fish Oil');
    expect(insertParams[2]).toBe('1000');
    expect(insertParams[3]).toBe('mg');
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(buildApp())
      .post('/api/medications/1')
      .send({ name: 'Aspirin', dosage: '81', dosage_metric: 'mg' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });
});

// US 14: Log a dose
describe('POST /api/logs/:patientId/:medicationId', () => {
  it('creates a dose log and returns it with status 201', async () => {
    const log = {
      id: 10,
      patient_id: 1,
      medication_id: 3,
      logged_at: '2026-04-12T10:00:00.000Z',
    };
    db.query
      .mockResolvedValueOnce([{ insertId: 10 }])
      .mockResolvedValueOnce([[log]]);

    const res = await request(buildApp()).post('/api/logs/1/3');

    expect(res.status).toBe(201);
    expect(res.body).toEqual(log);
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(buildApp()).post('/api/logs/1/3');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });
});

// US 14: Get today's logs
describe("GET /api/logs/:patientId/today", () => {
  it("returns today's dose logs for the patient", async () => {
    const logs = [
      { id: 1, patient_id: 1, medication_id: 2, logged_at: '2026-04-12T08:30:00.000Z' },
      { id: 2, patient_id: 1, medication_id: 4, logged_at: '2026-04-12T09:15:00.000Z' },
    ];
    db.query.mockResolvedValueOnce([logs]);

    const res = await request(buildApp()).get('/api/logs/1/today');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(logs);
  });

  it('returns an empty array when no doses have been logged today', async () => {
    db.query.mockResolvedValueOnce([[]]);

    const res = await request(buildApp()).get('/api/logs/1/today');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(buildApp()).get('/api/logs/1/today');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });
});

// US 13: Edit a medication
describe('PUT /api/medications/:patientId/:medicationId', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(buildApp())
      .put('/api/medications/1/2')
      .send({ dosage: '500', dosage_metric: 'mg' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'name, dosage, and dosage_metric are required' });
  });

  it('returns 400 when dosage is missing', async () => {
    const res = await request(buildApp())
      .put('/api/medications/1/2')
      .send({ name: 'Metformin', dosage_metric: 'mg' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'name, dosage, and dosage_metric are required' });
  });

  it('returns 400 when dosage_metric is missing', async () => {
    const res = await request(buildApp())
      .put('/api/medications/1/2')
      .send({ name: 'Metformin', dosage: '500' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'name, dosage, and dosage_metric are required' });
  });

  it('returns 404 when the medication does not belong to the patient', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const res = await request(buildApp())
      .put('/api/medications/1/99')
      .send({ name: 'Metformin', dosage: '500', dosage_metric: 'mg' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Medication not found' });
  });

  it('updates the medication and returns the updated record', async () => {
    const updated = {
      id: 2, patient_id: 1, name: 'Metformin', dosage: '1000', dosage_metric: 'mg',
      frequency_when: 'twice', frequency_period: 'daily', source: 'provider', status: 'active',
    };
    db.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);

    const res = await request(buildApp())
      .put('/api/medications/1/2')
      .send({ name: 'Metformin', dosage: '1000', dosage_metric: 'mg', frequency_when: 'twice', frequency_period: 'daily' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
  });

  it('trims whitespace from name, dosage, and dosage_metric', async () => {
    const updated = {
      id: 2, patient_id: 1, name: 'Metformin', dosage: '500', dosage_metric: 'mg',
      frequency_when: 'once', frequency_period: 'daily', source: 'provider', status: 'active',
    };
    db.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);

    await request(buildApp())
      .put('/api/medications/1/2')
      .send({ name: '  Metformin  ', dosage: ' 500 ', dosage_metric: ' mg ' });

    const updateParams = db.query.mock.calls[0][1];
    expect(updateParams[0]).toBe('Metformin');
    expect(updateParams[1]).toBe('500');
    expect(updateParams[2]).toBe('mg');
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(buildApp())
      .put('/api/medications/1/2')
      .send({ name: 'Metformin', dosage: '500', dosage_metric: 'mg' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });
});

// US 13: Deactivate a medication
describe('PATCH /api/medications/:patientId/:medicationId/deactivate', () => {
  it('returns 404 when the medication is not found', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const res = await request(buildApp()).patch('/api/medications/1/99/deactivate');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Medication not found' });
  });

  it('sets the medication status to inactive and returns success', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(buildApp()).patch('/api/medications/1/2/deactivate');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it("uses status='inactive' in the UPDATE query", async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await request(buildApp()).patch('/api/medications/1/2/deactivate');

    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/SET status = 'inactive'/);
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(buildApp()).patch('/api/medications/1/2/deactivate');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });
});

// US 15: Medication history / trends
describe('GET /api/logs/:patientId/history', () => {
  it('returns 400 when days is less than 1', async () => {
    const res = await request(buildApp()).get('/api/logs/1/history?days=0');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'days must be between 1 and 365' });
  });

  it('returns 400 when days is greater than 365', async () => {
    const res = await request(buildApp()).get('/api/logs/1/history?days=366');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'days must be between 1 and 365' });
  });

  it('returns history logs joined with medication details', async () => {
    const logs = [
      {
        id: 1, medication_id: 2, medication_name: 'Metformin',
        dosage: '500', dosage_metric: 'mg',
        logged_at: '2026-04-12T08:00:00.000Z', log_date: '2026-04-12',
      },
    ];
    db.query
      .mockResolvedValueOnce([logs])
      .mockResolvedValueOnce([[{ id: 2, created_date: '2026-04-12' }]]);

    const res = await request(buildApp()).get('/api/logs/1/history?days=7');

    expect(res.status).toBe(200);
    expect(res.body.logs).toEqual(logs);
  });

  it('defaults to a 7-day window when the query param is omitted', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    await request(buildApp()).get('/api/logs/1/history');

    // The route passes days-1 to the INTERVAL clause; default days=7 → param=6
    const params = db.query.mock.calls[0][1];
    expect(params[1]).toBe(6);
  });

  it('returns an empty array when no logs exist in the range', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const res = await request(buildApp()).get('/api/logs/1/history?days=7');

    expect(res.status).toBe(200);
    expect(res.body.logs).toEqual([]);
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(buildApp()).get('/api/logs/1/history?days=7');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });
});

// US 16: Fetch reminders
describe('GET /api/reminders/:patientId', () => {
  it('returns saved reminders for the patient', async () => {
    const reminders = [
      { id: 1, patient_id: 1, medication_id: 2, reminder_time: '08:00', enabled: 1 },
      { id: 2, patient_id: 1, medication_id: 3, reminder_time: '20:00', enabled: 0 },
    ];
    db.query.mockResolvedValueOnce([reminders]);

    const res = await request(buildApp()).get('/api/reminders/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(reminders);
  });

  it('returns an empty array when no reminders exist', async () => {
    db.query.mockResolvedValueOnce([[]]);

    const res = await request(buildApp()).get('/api/reminders/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(buildApp()).get('/api/reminders/1');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });
});

// US 16: Upsert a reminder
describe('POST /api/reminders/:patientId/:medicationId', () => {
  it('returns 400 when reminder_time is missing', async () => {
    const res = await request(buildApp())
      .post('/api/reminders/1/2')
      .send({ enabled: true });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'reminder_time must be in HH:MM format' });
  });

  it('returns 400 when reminder_time has an invalid format', async () => {
    const res = await request(buildApp())
      .post('/api/reminders/1/2')
      .send({ reminder_time: '8:00', enabled: true });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'reminder_time must be in HH:MM format' });
  });

  it('upserts the reminder and returns the saved record with status 201', async () => {
    const saved = { id: 1, patient_id: 1, medication_id: 2, reminder_time: '08:00', enabled: 1 };
    db.query
      .mockResolvedValueOnce([{}])        // INSERT … ON DUPLICATE KEY UPDATE
      .mockResolvedValueOnce([[saved]]);  // SELECT

    const res = await request(buildApp())
      .post('/api/reminders/1/2')
      .send({ reminder_time: '08:00', enabled: true });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(saved);
  });

  it('stores enabled=0 when enabled is false', async () => {
    const saved = { id: 2, patient_id: 1, medication_id: 3, reminder_time: '20:00', enabled: 0 };
    db.query
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[saved]]);

    await request(buildApp())
      .post('/api/reminders/1/3')
      .send({ reminder_time: '20:00', enabled: false });

    const insertParams = db.query.mock.calls[0][1];
    expect(insertParams[3]).toBe(0);
  });

  it('stores enabled=1 when enabled is true', async () => {
    const saved = { id: 1, patient_id: 1, medication_id: 2, reminder_time: '08:00', enabled: 1 };
    db.query
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[saved]]);

    await request(buildApp())
      .post('/api/reminders/1/2')
      .send({ reminder_time: '08:00', enabled: true });

    const insertParams = db.query.mock.calls[0][1];
    expect(insertParams[3]).toBe(1);
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(buildApp())
      .post('/api/reminders/1/2')
      .send({ reminder_time: '08:00', enabled: true });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });
});
