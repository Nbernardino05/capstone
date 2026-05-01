'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Demo accounts created on every fresh install.
// Passwords are intentionally simple — change before any real deployment.
const DEMO_CLINICIAN = {
  name: 'Dr. Demo',
  email: 'demo.clinician@example.com',
  password: 'Password123!',
  practice: 'Demo Clinic',
};

const DEMO_PATIENT = {
  name: 'Demo Patient',
  email: 'demo.patient@example.com',
  password: 'Password123!',
};

const DEMO_MEDICATIONS = [
  { name: 'Adderall XR', dosage: '20',  dosage_metric: 'mg', frequency_when: 'once', frequency_period: 'morning', source: 'provider', status: 'active' },
  { name: 'Wellbutrin',  dosage: '150', dosage_metric: 'mg', frequency_when: 'once', frequency_period: 'nightly', source: 'provider', status: 'active' },
];

async function main() {
  const conn = await mysql.createConnection({
    host:               process.env.DB_HOST,
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    multipleStatements: true,  // needed to execute the full schema file at once
  });

  try {
    // --- Schema ---
    console.log('Running schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await conn.query(schema);
    console.log('  Schema OK.');

    await conn.query('USE capstone');

    // --- Demo clinician ---
    const [[existingClinician]] = await conn.query(
      'SELECT id FROM clinicians WHERE email = ?', [DEMO_CLINICIAN.email]
    );
    let clinicianId;
    if (existingClinician) {
      clinicianId = existingClinician.id;
      console.log('  Demo clinician already exists, skipping.');
    } else {
      const hash = await bcrypt.hash(DEMO_CLINICIAN.password, 10);
      const [result] = await conn.query(
        'INSERT INTO clinicians (name, email, password, practice) VALUES (?, ?, ?, ?)',
        [DEMO_CLINICIAN.name, DEMO_CLINICIAN.email, hash, DEMO_CLINICIAN.practice]
      );
      clinicianId = result.insertId;
      console.log(`  Demo clinician created (id=${clinicianId}).`);
    }

    // --- Demo patient ---
    const [[patientRow]] = await conn.query(
      'SELECT id FROM patients WHERE name = ?', [DEMO_PATIENT.name]
    );

    let patientId;
    if (patientRow) {
      patientId = patientRow.id;
      await conn.query(
        'UPDATE patients SET clinician_id = ? WHERE id = ?', [clinicianId, patientId]
      );
      console.log('  Demo patient already exists, updated clinician link.');
    } else {
      const [result] = await conn.query(
        'INSERT INTO patients (name, clinician_id) VALUES (?, ?)',
        [DEMO_PATIENT.name, clinicianId]
      );
      patientId = result.insertId;
      console.log(`  Demo patient created (id=${patientId}).`);

      for (const med of DEMO_MEDICATIONS) {
        await conn.query(
          `INSERT INTO medications
             (patient_id, name, dosage, dosage_metric, frequency_when, frequency_period, source, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [patientId, med.name, med.dosage, med.dosage_metric,
           med.frequency_when, med.frequency_period, med.source, med.status]
        );
      }
      console.log('  Demo medications seeded.');
    }

    // --- Demo patient_users ---
    const [[existingUser]] = await conn.query(
      'SELECT id FROM patient_users WHERE patient_id = ?', [patientId]
    );
    if (existingUser) {
      console.log('  Demo patient_user already exists, skipping.');
    } else {
      const hash = await bcrypt.hash(DEMO_PATIENT.password, 10);
      await conn.query(
        'INSERT INTO patient_users (patient_id, email, password) VALUES (?, ?, ?)',
        [patientId, DEMO_PATIENT.email, hash]
      );
      console.log('  Demo patient_user created.');
    }

    console.log('\nSetup complete!');
    console.log('  Clinician  →  demo.clinician@example.com  /  Password123!');
    console.log('  Patient    →  demo.patient@example.com    /  Password123!');
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
