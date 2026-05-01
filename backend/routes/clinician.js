const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireClinician } = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// US 3 & 4: Send patient invitation with optional medications
// POST /api/clinician/invite
// Body: { patient_name, patient_email, medications?: [{ name, dosage, dosage_metric, frequency_when, frequency_period }] }
router.post('/clinician/invite', requireClinician, async (req, res) => {
  const { patient_name, patient_email, medications = [] } = req.body;
  const clinicianId = req.clinicianId;

  if (!patient_name || !patient_email) {
    return res.status(400).json({ error: 'patient_name and patient_email are required' });
  }
  if (!EMAIL_RE.test(patient_email)) {
    return res.status(400).json({ error: 'Invalid patient email format' });
  }

  for (const med of medications) {
    if (!med.name || !med.dosage || !med.dosage_metric) {
      return res.status(400).json({ error: 'Each medication requires name, dosage, and dosage_metric' });
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Generate unique 8-character code
    let code;
    let codeExists = true;
    while (codeExists) {
      code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const [existing] = await conn.query('SELECT id FROM invitations WHERE code = ?', [code]);
      codeExists = existing.length > 0;
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [result] = await conn.query(
      `INSERT INTO invitations (clinician_id, patient_name, patient_email, code, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [clinicianId, patient_name.trim(), patient_email.toLowerCase(), code, expiresAt]
    );
    const invitationId = result.insertId;

    for (const med of medications) {
      await conn.query(
        `INSERT INTO invitation_medications
           (invitation_id, name, dosage, dosage_metric, frequency_when, frequency_period)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          invitationId,
          med.name.trim(),
          med.dosage.trim(),
          med.dosage_metric.trim(),
          med.frequency_when || 'once',
          med.frequency_period || 'daily',
        ]
      );
    }

    await conn.commit();

    // Email would be sent here; log code for dev
    console.log(`[Invitation] code=${code} → ${patient_email}`);

    res.status(201).json({
      invitation: {
        id: invitationId,
        code,
        expires_at: expiresAt,
        patient_name: patient_name.trim(),
        patient_email: patient_email.toLowerCase(),
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    conn.release();
  }
});

// US 5: List patients linked to clinician
// GET /api/clinician/patients
router.get('/clinician/patients', requireClinician, async (req, res) => {
  const clinicianId = req.clinicianId;
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.name, p.created_at,
              pu.email
       FROM patients p
       LEFT JOIN patient_users pu ON pu.patient_id = p.id
       WHERE p.clinician_id = ?
       ORDER BY p.name ASC`,
      [clinicianId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 6: Single patient summary
// GET /api/clinician/patients/:patientId
router.get('/clinician/patients/:patientId', requireClinician, async (req, res) => {
  const clinicianId = req.clinicianId;
  const { patientId } = req.params;
  try {
    const [patients] = await db.query(
      `SELECT p.id, p.name, p.created_at, pu.email
       FROM patients p
       LEFT JOIN patient_users pu ON pu.patient_id = p.id
       WHERE p.id = ? AND p.clinician_id = ?`,
      [patientId, clinicianId]
    );
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const [meds] = await db.query(
      `SELECT id, name, dosage, dosage_metric, frequency_when, frequency_period, status
       FROM medications WHERE patient_id = ? ORDER BY status ASC, name ASC`,
      [patientId]
    );

    res.json({ patient: patients[0], medications: meds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 7: Patient medication adherence chart data
// GET /api/clinician/patients/:patientId/adherence?days=30
router.get('/clinician/patients/:patientId/adherence', requireClinician, async (req, res) => {
  const clinicianId = req.clinicianId;
  const { patientId } = req.params;
  const days = Math.max(1, Math.min(365, parseInt(req.query.days) || 30));

  try {
    const [patients] = await db.query(
      'SELECT id FROM patients WHERE id = ? AND clinician_id = ?',
      [patientId, clinicianId]
    );
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Active medications with creation date so the frontend can exclude
    // pre-existence days from missed/adherence calculations
    const [meds] = await db.query(
      `SELECT id, name, DATE_FORMAT(created_at, '%Y-%m-%d') AS created_date
       FROM medications WHERE patient_id = ? AND status = 'active'`,
      [patientId]
    );

    // Logs grouped by (medication_id, date) — one row per unique combination
    const [logs] = await db.query(
      `SELECT
         medication_id,
         DATE_FORMAT(logged_at, '%Y-%m-%d') AS log_date,
         COUNT(*) AS dose_count
       FROM medication_logs
       WHERE patient_id = ?
         AND logged_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY medication_id, log_date
       ORDER BY log_date ASC`,
      [patientId, days - 1]
    );

    // Count only days from when each medication actually existed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowStart = new Date(today);
    windowStart.setDate(today.getDate() - (days - 1));
    const windowStartStr = windowStart.toISOString().slice(0, 10);
    const msPerDay = 24 * 60 * 60 * 1000;

    let totalScheduled = 0;
    for (const med of meds) {
      const effectiveStart = med.created_date > windowStartStr ? med.created_date : windowStartStr;
      const daysForMed = Math.round((today - new Date(effectiveStart + 'T00:00:00')) / msPerDay) + 1;
      totalScheduled += Math.max(0, daysForMed);
    }

    const totalLogged = logs.length;
    const adherencePercent = totalScheduled > 0
      ? Math.round((totalLogged / totalScheduled) * 100)
      : 0;

    res.json({ medications: meds, logs, adherencePercent, days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 8: Patient effectiveness (survey) trend data
// GET /api/clinician/patients/:patientId/surveys?days=30
router.get('/clinician/patients/:patientId/surveys', requireClinician, async (req, res) => {
  const clinicianId = req.clinicianId;
  const { patientId } = req.params;
  const days = Math.max(1, Math.min(365, parseInt(req.query.days) || 30));

  try {
    const [patients] = await db.query(
      'SELECT id FROM patients WHERE id = ? AND clinician_id = ?',
      [patientId, clinicianId]
    );
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const [rows] = await db.query(
      `SELECT
         DATE_FORMAT(cis.survey_date, '%Y-%m-%d') AS survey_date,
         sr.medication_id,
         sr.medication_name,
         sr.efficacy_rating,
         sr.side_effects
       FROM check_in_surveys cis
       JOIN survey_responses sr ON sr.survey_id = cis.id
       WHERE cis.patient_id = ?
         AND cis.survey_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY cis.survey_date ASC`,
      [patientId, days - 1]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
