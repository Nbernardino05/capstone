const express = require('express');
const db = require('../db');
const { requirePatient } = require('../middleware/auth');

const router = express.Router();

function ownsPatient(req, res, patientId) {
  if (req.patientId !== parseInt(patientId, 10)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

// US 11: Fetch all medications
// GET /api/medications/:patientId
router.get('/medications/:patientId', requirePatient, async (req, res) => {
  const { patientId } = req.params;
  if (!ownsPatient(req, res, patientId)) return;
  try {
    const [rows] = await db.query(
      `SELECT id, patient_id, name, dosage, dosage_metric, frequency_when,
              frequency_period, source, status
       FROM medications
       WHERE patient_id = ?
       ORDER BY source DESC, created_at ASC`,
      [patientId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 11: Bulk-confirm medication statuses
// PATCH /api/medications/:patientId/confirm
// Body: { updates: [{ id: number, status: 'active' | 'inactive' }] }
router.patch('/medications/:patientId/confirm', requirePatient, async (req, res) => {
  const { patientId } = req.params;
  if (!ownsPatient(req, res, patientId)) return;
  const { updates } = req.body;

  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'updates must be an array' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const { id, status } of updates) {
      if (status !== 'active' && status !== 'inactive') {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: `Invalid status value: ${status}` });
      }
      await conn.query(
        'UPDATE medications SET status = ? WHERE id = ? AND patient_id = ?',
        [status, id, patientId]
      );
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    conn.release();
  }
});

// US 12: Add patient-entered medication
// POST /api/medications/:patientId
// source and status are always set server-side: source='patient', status='active'
router.post('/medications/:patientId', requirePatient, async (req, res) => {
  const { patientId } = req.params;
  if (!ownsPatient(req, res, patientId)) return;
  const { name, dosage, dosage_metric, frequency_when, frequency_period } = req.body;

  if (!name || !dosage || !dosage_metric) {
    return res.status(400).json({ error: 'name, dosage, and dosage_metric are required' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO medications
         (patient_id, name, dosage, dosage_metric, frequency_when, frequency_period, source, status)
       VALUES (?, ?, ?, ?, ?, ?, 'patient', 'active')`,
      [
        patientId,
        name.trim(),
        dosage.trim(),
        dosage_metric.trim(),
        frequency_when || 'once',
        frequency_period || 'daily',
      ]
    );

    const insertedId = result.insertId;
    const [rows] = await db.query(
      `SELECT id, patient_id, name, dosage, dosage_metric, frequency_when,
              frequency_period, source, status
       FROM medications WHERE id = ?`,
      [insertedId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 13: Edit a medication
// PUT /api/medications/:patientId/:medicationId
// Body: { dosage, dosage_metric, frequency_when, frequency_period }
// name is intentionally not editable (prescriptions are fixed by name)
router.put('/medications/:patientId/:medicationId', requirePatient, async (req, res) => {
  const { patientId, medicationId } = req.params;
  if (!ownsPatient(req, res, patientId)) return;
  const { name, dosage, dosage_metric, frequency_when, frequency_period } = req.body;

  if (!name || !dosage || !dosage_metric) {
    return res.status(400).json({ error: 'name, dosage, and dosage_metric are required' });
  }

  try {
    const [result] = await db.query(
      `UPDATE medications
       SET name = ?, dosage = ?, dosage_metric = ?, frequency_when = ?, frequency_period = ?
       WHERE id = ? AND patient_id = ?`,
      [
        name.trim(),
        dosage.trim(),
        dosage_metric.trim(),
        frequency_when || 'once',
        frequency_period || 'daily',
        medicationId,
        patientId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    const [rows] = await db.query(
      `SELECT id, patient_id, name, dosage, dosage_metric, frequency_when,
              frequency_period, source, status
       FROM medications WHERE id = ?`,
      [medicationId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 13: Deactivate (stop taking) a medication
// PATCH /api/medications/:patientId/:medicationId/deactivate
router.patch('/medications/:patientId/:medicationId/deactivate', requirePatient, async (req, res) => {
  const { patientId, medicationId } = req.params;
  if (!ownsPatient(req, res, patientId)) return;
  try {
    const [result] = await db.query(
      `UPDATE medications SET status = 'inactive'
       WHERE id = ? AND patient_id = ?`,
      [medicationId, patientId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 14: Log a dose
// POST /api/logs/:patientId/:medicationId
router.post('/logs/:patientId/:medicationId', requirePatient, async (req, res) => {
  const { patientId, medicationId } = req.params;
  if (!ownsPatient(req, res, patientId)) return;
  try {
    const [result] = await db.query(
      'INSERT INTO medication_logs (patient_id, medication_id) VALUES (?, ?)',
      [patientId, medicationId]
    );
    const [rows] = await db.query(
      'SELECT id, patient_id, medication_id, logged_at FROM medication_logs WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/logs/:patientId/today
// Fetch today's dose logs for session restoration (US 14)
router.get('/logs/:patientId/today', requirePatient, async (req, res) => {
  const { patientId } = req.params;
  if (!ownsPatient(req, res, patientId)) return;
  try {
    const [rows] = await db.query(
      `SELECT id, patient_id, medication_id, logged_at
       FROM medication_logs
       WHERE patient_id = ?
         AND DATE(logged_at) = CURDATE()
       ORDER BY logged_at ASC`,
      [patientId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 15: Medication history / trends
// GET /api/logs/:patientId/history?days=7
// Returns logs joined with medication name, grouped by date (newest first)
// Also fills in missed days (days with no logs) within the range
router.get('/logs/:patientId/history', requirePatient, async (req, res) => {
  const { patientId } = req.params;
  if (!ownsPatient(req, res, patientId)) return;
  const parsedDays = parseInt(req.query.days);
  const days = Number.isNaN(parsedDays) ? 7 : parsedDays;

  if (days < 1 || days > 365) {
    return res.status(400).json({ error: 'days must be between 1 and 365' });
  }

  try {
    const [rows] = await db.query(
      `SELECT
         ml.id,
         ml.medication_id,
         m.name            AS medication_name,
         m.dosage,
         m.dosage_metric,
         ml.logged_at,
         DATE_FORMAT(ml.logged_at, '%Y-%m-%d') AS log_date
       FROM medication_logs ml
       JOIN medications m ON ml.medication_id = m.id
       WHERE ml.patient_id = ?
         AND ml.logged_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY ml.logged_at DESC`,
      [patientId, days - 1]
    );

    // All active medications with individual creation dates for per-med adherence calc
    const [activeMeds] = await db.query(
      `SELECT id, DATE_FORMAT(created_at, '%Y-%m-%d') AS created_date
       FROM medications WHERE patient_id = ? AND status = 'active'`,
      [patientId]
    );

    // Compute adherence using same per-medication-per-day logic as the clinician endpoint
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowStart = new Date(today);
    windowStart.setDate(today.getDate() - (days - 1));
    const windowStartStr = windowStart.toISOString().slice(0, 10);
    const msPerDay = 24 * 60 * 60 * 1000;

    let totalScheduled = 0;
    for (const med of activeMeds) {
      const effectiveStart = med.created_date > windowStartStr ? med.created_date : windowStartStr;
      const daysForMed = Math.round((today - new Date(effectiveStart + 'T00:00:00')) / msPerDay) + 1;
      totalScheduled += Math.max(0, daysForMed);
    }

    // Count unique (medication_id, date) pairs logged — identical to clinician endpoint
    const loggedPairs = new Set(rows.map(r => `${r.medication_id}:${r.log_date}`));
    const totalLogged = loggedPairs.size;

    const adherencePercent = totalScheduled > 0
      ? Math.round((totalLogged / totalScheduled) * 100)
      : 0;

    const startDate = activeMeds.length > 0
      ? activeMeds.reduce((min, m) => m.created_date < min ? m.created_date : min, activeMeds[0].created_date)
      : null;

    res.json({ logs: rows, startDate, adherencePercent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 16: Reminders
// GET /api/reminders/:patientId
router.get('/reminders/:patientId', requirePatient, async (req, res) => {
  const { patientId } = req.params;
  if (!ownsPatient(req, res, patientId)) return;
  try {
    const [rows] = await db.query(
      `SELECT id, patient_id, medication_id, reminder_time, enabled
       FROM reminders
       WHERE patient_id = ?`,
      [patientId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/reminders/:patientId/:medicationId
// Body: { reminder_time: 'HH:MM', enabled: boolean }
// Upserts: creates if absent, updates if exists
router.post('/reminders/:patientId/:medicationId', requirePatient, async (req, res) => {
  const { patientId, medicationId } = req.params;
  if (!ownsPatient(req, res, patientId)) return;
  const { reminder_time, enabled } = req.body;

  if (!reminder_time || !/^\d{2}:\d{2}$/.test(reminder_time)) {
    return res.status(400).json({ error: 'reminder_time must be in HH:MM format' });
  }

  const enabledVal = enabled === false ? 0 : 1;

  try {
    await db.query(
      `INSERT INTO reminders (patient_id, medication_id, reminder_time, enabled)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE reminder_time = VALUES(reminder_time), enabled = VALUES(enabled)`,
      [patientId, medicationId, reminder_time, enabledVal]
    );

    const [rows] = await db.query(
      `SELECT id, patient_id, medication_id, reminder_time, enabled
       FROM reminders
       WHERE patient_id = ? AND medication_id = ?`,
      [patientId, medicationId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
