const request = require('supertest');
const express = require('express');

jest.mock('../db');
const db = require('../db');

jest.mock('../middleware/auth', () => ({
  requirePatient: (req, _res, next) => { req.patientId = 1; next(); },
  requireClinician: (_req, _res, next) => next(),
}));

const router = require('../routes/surveys');

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

// US 17: Get today's survey
describe("GET /api/surveys/:patientId/today", () => {
  it('returns null when no survey has been submitted today', async () => {
    db.query.mockResolvedValueOnce([[]]);

    const res = await request(buildApp()).get('/api/surveys/1/today');

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns the survey with its responses when one exists for today', async () => {
    const survey = {
      id: 5, patient_id: 1, survey_date: '2026-04-12',
      submitted_at: '2026-04-12T09:00:00.000Z', updated_at: '2026-04-12T09:00:00.000Z',
    };
    const responses = [
      { id: 1, medication_id: 2, medication_name: 'Metformin', efficacy_rating: 4, side_effects: null },
      { id: 2, medication_id: 3, medication_name: 'Vitamin D', efficacy_rating: 5, side_effects: 'Nausea' },
    ];
    db.query
      .mockResolvedValueOnce([[survey]])
      .mockResolvedValueOnce([responses]);

    const res = await request(buildApp()).get('/api/surveys/1/today');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...survey, responses });
  });

  it('fetches responses using the survey id from the first query', async () => {
    const survey = {
      id: 7, patient_id: 1, survey_date: '2026-04-12',
      submitted_at: '2026-04-12T09:00:00.000Z', updated_at: '2026-04-12T09:00:00.000Z',
    };
    db.query
      .mockResolvedValueOnce([[survey]])
      .mockResolvedValueOnce([[]]);

    await request(buildApp()).get('/api/surveys/1/today');

    const responsesQueryParams = db.query.mock.calls[1][1];
    expect(responsesQueryParams).toEqual([7]);
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(buildApp()).get('/api/surveys/1/today');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });
});

// US 17: Submit today's survey
describe('POST /api/surveys/:patientId', () => {
  it('returns 400 when responses is not an array', async () => {
    const res = await request(buildApp())
      .post('/api/surveys/1')
      .send({ responses: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'responses must be a non-empty array' });
  });

  it('returns 400 when responses is an empty array', async () => {
    const res = await request(buildApp())
      .post('/api/surveys/1')
      .send({ responses: [] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'responses must be a non-empty array' });
  });

  it('returns 400 when a response is missing medication_id', async () => {
    const res = await request(buildApp())
      .post('/api/surveys/1')
      .send({ responses: [{ medication_name: 'Metformin', efficacy_rating: 4 }] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Each response needs medication_id, medication_name, and efficacy_rating',
    });
  });

  it('returns 400 when a response is missing medication_name', async () => {
    const res = await request(buildApp())
      .post('/api/surveys/1')
      .send({ responses: [{ medication_id: 2, efficacy_rating: 4 }] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Each response needs medication_id, medication_name, and efficacy_rating',
    });
  });

  it('returns 400 when a response is missing efficacy_rating', async () => {
    const res = await request(buildApp())
      .post('/api/surveys/1')
      .send({ responses: [{ medication_id: 2, medication_name: 'Metformin' }] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Each response needs medication_id, medication_name, and efficacy_rating',
    });
  });

  it('returns 400 when efficacy_rating is below 1', async () => {
    const res = await request(buildApp())
      .post('/api/surveys/1')
      .send({ responses: [{ medication_id: 2, medication_name: 'Metformin', efficacy_rating: 0 }] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'efficacy_rating must be between 1 and 5' });
  });

  it('returns 400 when efficacy_rating is above 5', async () => {
    const res = await request(buildApp())
      .post('/api/surveys/1')
      .send({ responses: [{ medication_id: 2, medication_name: 'Metformin', efficacy_rating: 6 }] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'efficacy_rating must be between 1 and 5' });
  });

  it('creates the survey with responses and returns 201', async () => {
    const surveyId = 5;
    const savedSurvey = {
      id: surveyId, patient_id: 1, survey_date: '2026-04-12',
      submitted_at: '2026-04-12T09:00:00.000Z', updated_at: '2026-04-12T09:00:00.000Z',
    };
    const savedResponses = [
      { id: 1, medication_id: 2, medication_name: 'Metformin', efficacy_rating: 4, side_effects: 'Nausea' },
    ];

    const conn = mockConnection({
      query: jest.fn()
        .mockResolvedValueOnce([{}])                       // INSERT survey header (upsert)
        .mockResolvedValueOnce([[{ id: surveyId }]])       // SELECT survey id
        .mockResolvedValueOnce([{}])                       // DELETE old responses
        .mockResolvedValueOnce([{}])                       // INSERT response
        .mockResolvedValueOnce([[savedSurvey]])            // SELECT survey header
        .mockResolvedValueOnce([savedResponses]),          // SELECT saved responses
    });

    const res = await request(buildApp())
      .post('/api/surveys/1')
      .send({
        responses: [{ medication_id: 2, medication_name: 'Metformin', efficacy_rating: 4, side_effects: 'Nausea' }],
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ...savedSurvey, responses: savedResponses });
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  it('stores null for side_effects when not provided in the response', async () => {
    const surveyId = 5;
    const conn = mockConnection({
      query: jest.fn()
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([[{ id: surveyId }]])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([[{ id: surveyId, patient_id: 1 }]])
        .mockResolvedValueOnce([[
          { id: 1, medication_id: 2, medication_name: 'Metformin', efficacy_rating: 3, side_effects: null },
        ]]),
    });

    await request(buildApp())
      .post('/api/surveys/1')
      .send({ responses: [{ medication_id: 2, medication_name: 'Metformin', efficacy_rating: 3 }] });

    // The 4th conn.query call (index 3) is the INSERT for the individual response
    const responseInsertParams = conn.query.mock.calls[3][1];
    expect(responseInsertParams[4]).toBeNull(); // side_effects param
  });

  it('supports multiple responses in a single submission', async () => {
    const surveyId = 5;
    const conn = mockConnection({
      query: jest.fn()
        .mockResolvedValueOnce([{}])                    // INSERT survey header
        .mockResolvedValueOnce([[{ id: surveyId }]])    // SELECT survey id
        .mockResolvedValueOnce([{}])                    // DELETE old responses
        .mockResolvedValueOnce([{}])                    // INSERT response 1
        .mockResolvedValueOnce([{}])                    // INSERT response 2
        .mockResolvedValueOnce([[{ id: surveyId, patient_id: 1 }]])
        .mockResolvedValueOnce([[
          { id: 1, medication_id: 2, medication_name: 'Metformin', efficacy_rating: 4, side_effects: null },
          { id: 2, medication_id: 3, medication_name: 'Vitamin D', efficacy_rating: 5, side_effects: null },
        ]]),
    });

    const res = await request(buildApp())
      .post('/api/surveys/1')
      .send({
        responses: [
          { medication_id: 2, medication_name: 'Metformin', efficacy_rating: 4 },
          { medication_id: 3, medication_name: 'Vitamin D', efficacy_rating: 5 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.responses).toHaveLength(2);
    expect(conn.commit).toHaveBeenCalled();
  });

  it('rolls back the transaction and returns 500 on database error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const conn = mockConnection({
      query: jest.fn().mockRejectedValueOnce(new Error('DB error')),
    });

    const res = await request(buildApp())
      .post('/api/surveys/1')
      .send({ responses: [{ medication_id: 2, medication_name: 'Metformin', efficacy_rating: 4 }] });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });
});
