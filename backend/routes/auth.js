const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// US 1: Clinician registration
// POST /api/auth/clinician/register
// Body: { name, email, password, practice }
router.post('/auth/clinician/register', async (req, res) => {
  const { name, email, password, practice } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const [existing] = await db.query(
      'SELECT id FROM clinicians WHERE email = ?',
      [email.toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await db.query(
      'INSERT INTO clinicians (name, email, password, practice) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase(), hash, practice?.trim() || null]
    );

    const clinicianId = result.insertId;
    const token = jwt.sign({ id: clinicianId, role: 'clinician' }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({
      token,
      clinician: { id: clinicianId, name: name.trim(), email: email.toLowerCase(), practice: practice?.trim() || null },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 2: Clinician login
// POST /api/auth/clinician/login
// Body: { email, password }
router.post('/auth/clinician/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const [rows] = await db.query(
      'SELECT id, name, email, password, practice FROM clinicians WHERE email = ?',
      [email.toLowerCase()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const clinician = rows[0];
    const match = await bcrypt.compare(password, clinician.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: clinician.id, role: 'clinician' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      clinician: { id: clinician.id, name: clinician.name, email: clinician.email, practice: clinician.practice },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 9: Patient login
// POST /api/auth/patient/login
// Body: { email, password }
router.post('/auth/patient/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const [rows] = await db.query(
      `SELECT pu.patient_id, pu.email, pu.password, p.name
       FROM patient_users pu
       JOIN patients p ON pu.patient_id = p.id
       WHERE pu.email = ?`,
      [email.toLowerCase()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ patientId: user.patient_id, role: 'patient' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      patient: { id: user.patient_id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 10: Validate invitation code (before registration)
// GET /api/invitations/:code
router.get('/invitations/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT patient_name, patient_email
       FROM invitations
       WHERE code = ? AND used = 0 AND expires_at > NOW()`,
      [code.toUpperCase()]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invitation code' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// US 10: Patient registration with invitation code
// POST /api/auth/patient/register
// Body: { invitation_code, email, password }
router.post('/auth/patient/register', async (req, res) => {
  const { invitation_code, email, password } = req.body;

  if (!invitation_code || !email || !password) {
    return res.status(400).json({ error: 'invitation_code, email, and password are required' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Validate invitation
    const [invites] = await conn.query(
      'SELECT * FROM invitations WHERE code = ? AND used = 0 AND expires_at > NOW()',
      [invitation_code.toUpperCase()]
    );
    if (invites.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Invalid or expired invitation code' });
    }

    const invitation = invites[0];

    // Check email uniqueness
    const [existingUsers] = await conn.query(
      'SELECT id FROM patient_users WHERE email = ?',
      [email.toLowerCase()]
    );
    if (existingUsers.length > 0) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({ error: 'Email already in use' });
    }

    // Create patient record linked to clinician
    const [patientResult] = await conn.query(
      'INSERT INTO patients (name, clinician_id) VALUES (?, ?)',
      [invitation.patient_name, invitation.clinician_id]
    );
    const patientId = patientResult.insertId;

    // Create auth record
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await conn.query(
      'INSERT INTO patient_users (patient_id, email, password) VALUES (?, ?, ?)',
      [patientId, email.toLowerCase(), hash]
    );

    // Copy invitation medications as provider-added meds
    const [inviteMeds] = await conn.query(
      'SELECT * FROM invitation_medications WHERE invitation_id = ?',
      [invitation.id]
    );
    for (const med of inviteMeds) {
      await conn.query(
        `INSERT INTO medications
           (patient_id, name, dosage, dosage_metric, frequency_when, frequency_period, source, status)
         VALUES (?, ?, ?, ?, ?, ?, 'provider', 'active')`,
        [patientId, med.name, med.dosage, med.dosage_metric, med.frequency_when, med.frequency_period]
      );
    }

    // Mark invitation as used
    await conn.query(
      'UPDATE invitations SET used = 1, patient_id = ? WHERE id = ?',
      [patientId, invitation.id]
    );

    await conn.commit();

    const token = jwt.sign({ patientId, role: 'patient' }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({
      token,
      patient: { id: patientId, name: invitation.patient_name, email: email.toLowerCase() },
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    conn.release();
  }
});

module.exports = router;
