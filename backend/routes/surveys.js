const express = require('express');
const db = require('../db');
const { requirePatient } = require('../middleware/auth');

const router = express.Router();

// US 17: Daily check-in surveys
// GET /api/surveys/:patientId/today
// Returns today's survey with its responses, or null if none submitted yet
router.get('/surveys/:patientId/today', requirePatient, async (req, res) => {
  const { patientId } = req.params;
  if (req.patientId !== parseInt(patientId, 10)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const [surveys] = await db.query(
      `SELECT id, patient_id, survey_date, submitted_at, updated_at
       FROM check_in_surveys
       WHERE patient_id = ? AND survey_date = CURDATE()
       LIMIT 1`,
      [patientId]
    );

    if (surveys.length === 0) {
      return res.json(null);
    }

    const survey = surveys[0];
    const [responses] = await db.query(
      `SELECT id, medication_id, medication_name, efficacy_rating, side_effects
       FROM survey_responses
       WHERE survey_id = ?`,
      [survey.id]
    );

    res.json({ ...survey, responses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/surveys/:patientId
// Submit or overwrite today's survey.
// Body: { responses: [{ medication_id, medication_name, efficacy_rating, side_effects? }] }
router.post('/surveys/:patientId', requirePatient, async (req, res) => {
  const { patientId } = req.params;
  if (req.patientId !== parseInt(patientId, 10)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { responses } = req.body;

  if (!Array.isArray(responses) || responses.length === 0) {
    return res.status(400).json({ error: 'responses must be a non-empty array' });
  }

  for (const r of responses) {
    if (!r.medication_id || !r.medication_name || r.efficacy_rating == null) {
      return res.status(400).json({ error: 'Each response needs medication_id, medication_name, and efficacy_rating' });
    }
    if (r.efficacy_rating < 1 || r.efficacy_rating > 5) {
      return res.status(400).json({ error: 'efficacy_rating must be between 1 and 5' });
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Upsert the survey header (one per patient per day)
    await conn.query(
      `INSERT INTO check_in_surveys (patient_id, survey_date)
       VALUES (?, CURDATE())
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [patientId]
    );

    const [existing] = await conn.query(
      `SELECT id FROM check_in_surveys WHERE patient_id = ? AND survey_date = CURDATE()`,
      [patientId]
    );
    const surveyId = existing[0].id;

    // Replace all responses for this survey (supports editing within 24h)
    await conn.query('DELETE FROM survey_responses WHERE survey_id = ?', [surveyId]);

    for (const r of responses) {
      await conn.query(
        `INSERT INTO survey_responses (survey_id, medication_id, medication_name, efficacy_rating, side_effects)
         VALUES (?, ?, ?, ?, ?)`,
        [surveyId, r.medication_id, r.medication_name, r.efficacy_rating, r.side_effects || null]
      );
    }

    await conn.commit();

    const [surveys] = await conn.query(
      `SELECT id, patient_id, survey_date, submitted_at, updated_at
       FROM check_in_surveys WHERE id = ?`,
      [surveyId]
    );
    const [savedResponses] = await conn.query(
      `SELECT id, medication_id, medication_name, efficacy_rating, side_effects
       FROM survey_responses WHERE survey_id = ?`,
      [surveyId]
    );

    res.status(201).json({ ...surveys[0], responses: savedResponses });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    conn.release();
  }
});

module.exports = router;
