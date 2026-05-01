// Mock react-native before the module under test loads it
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import { getTodaySurvey, submitSurvey } from '../src/api/surveys';

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

// getTodaySurvey (US 17)
describe('getTodaySurvey', () => {
  it("GETs /surveys/:patientId/today and returns null when no survey exists", async () => {
    mockFetch(200, null);

    const result = await getTodaySurvey(1);

    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/surveys/1/today`, expect.objectContaining({ headers: {} }));
    expect(result).toBeNull();
  });

  it('returns the full survey with responses when one exists today', async () => {
    const survey = {
      id: 5,
      patient_id: 1,
      survey_date: '2026-04-12',
      submitted_at: '2026-04-12T09:00:00Z',
      updated_at: '2026-04-12T09:00:00Z',
      responses: [
        { id: 1, medication_id: 2, medication_name: 'Metformin', efficacy_rating: 4, side_effects: null },
      ],
    };
    mockFetch(200, survey);

    const result = await getTodaySurvey(1);

    expect(result).toEqual(survey);
  });

  it('throws with the HTTP status on a non-OK response', async () => {
    mockFetch(500, { error: 'Database error' });
    await expect(getTodaySurvey(1)).rejects.toThrow('HTTP 500');
  });
});

// submitSurvey (US 17)
describe('submitSurvey', () => {
  it('POSTs to /surveys/:patientId with the responses array', async () => {
    const responses = [
      { medication_id: 2, medication_name: 'Metformin', efficacy_rating: 4 },
    ];
    const saved = {
      id: 5,
      patient_id: 1,
      survey_date: '2026-04-12',
      submitted_at: '2026-04-12T09:00:00Z',
      updated_at: '2026-04-12T09:00:00Z',
      responses: [
        { id: 1, medication_id: 2, medication_name: 'Metformin', efficacy_rating: 4, side_effects: null },
      ],
    };
    mockFetch(201, saved);

    const result = await submitSurvey(1, responses);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/surveys/1`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ responses }),
      })
    );
    expect(result).toEqual(saved);
  });

  it('includes side_effects in the request body when provided', async () => {
    const responses = [
      { medication_id: 2, medication_name: 'Metformin', efficacy_rating: 3, side_effects: 'Nausea, Headache' },
    ];
    mockFetch(201, { id: 5, patient_id: 1, survey_date: '2026-04-12', responses: [] });

    await submitSurvey(1, responses);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.responses[0].side_effects).toBe('Nausea, Headache');
  });

  it('throws with the HTTP status on a non-OK response', async () => {
    mockFetch(400, { error: 'responses must be a non-empty array' });
    await expect(submitSurvey(1, [])).rejects.toThrow('HTTP 400');
  });
});
