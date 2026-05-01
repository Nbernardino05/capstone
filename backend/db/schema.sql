-- ============================================================
-- MedTracker — Consolidated Schema
-- Run via: npm run db:setup
-- ============================================================

CREATE DATABASE IF NOT EXISTS capstone;
USE capstone;

-- 1. clinicians (no dependencies)
CREATE TABLE IF NOT EXISTS clinicians (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  practice   VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. patients (FK to clinicians)
CREATE TABLE IF NOT EXISTS patients (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  clinician_id INT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinician_id) REFERENCES clinicians(id) ON DELETE SET NULL
);

-- 3. patient_users — one auth record per patient
CREATE TABLE IF NOT EXISTS patient_users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL UNIQUE,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 4. medications
CREATE TABLE IF NOT EXISTS medications (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  patient_id       INT NOT NULL,
  name             VARCHAR(255) NOT NULL,
  dosage           VARCHAR(100) NOT NULL,
  dosage_metric    VARCHAR(50)  NOT NULL DEFAULT 'mg',
  frequency_when   VARCHAR(100) NOT NULL DEFAULT 'once',
  frequency_period VARCHAR(100) NOT NULL DEFAULT 'daily',
  source           ENUM('provider', 'patient') NOT NULL DEFAULT 'provider',
  status           ENUM('active', 'inactive')  NOT NULL DEFAULT 'active',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 5. medication_logs — timestamped dose records
CREATE TABLE IF NOT EXISTS medication_logs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  patient_id    INT NOT NULL,
  medication_id INT NOT NULL,
  logged_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)    REFERENCES patients(id)    ON DELETE CASCADE,
  FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
);

-- 6. reminders — one per (patient, medication)
CREATE TABLE IF NOT EXISTS reminders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  patient_id    INT NOT NULL,
  medication_id INT NOT NULL,
  reminder_time VARCHAR(5) NOT NULL,  -- HH:MM 24-hour
  enabled       TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)    REFERENCES patients(id)    ON DELETE CASCADE,
  FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
  UNIQUE KEY uq_patient_med (patient_id, medication_id)
);

-- 7. check_in_surveys — one per (patient, day)
CREATE TABLE IF NOT EXISTS check_in_surveys (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  patient_id   INT NOT NULL,
  survey_date  DATE NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  UNIQUE KEY uq_patient_date (patient_id, survey_date)
);

-- 8. survey_responses — one row per medication rated in a survey
CREATE TABLE IF NOT EXISTS survey_responses (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  survey_id       INT NOT NULL,
  medication_id   INT NOT NULL,
  medication_name VARCHAR(255) NOT NULL,
  efficacy_rating INT NOT NULL,       -- 1–5 scale
  side_effects    TEXT DEFAULT NULL,  -- comma-separated list
  FOREIGN KEY (survey_id)     REFERENCES check_in_surveys(id) ON DELETE CASCADE,
  FOREIGN KEY (medication_id) REFERENCES medications(id)      ON DELETE CASCADE
);

-- 9. invitations — clinician-generated patient onboarding codes
CREATE TABLE IF NOT EXISTS invitations (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  clinician_id  INT NOT NULL,
  patient_name  VARCHAR(255) NOT NULL,
  patient_email VARCHAR(255) NOT NULL,
  code          VARCHAR(20) NOT NULL UNIQUE,
  expires_at    TIMESTAMP NOT NULL,
  used          TINYINT(1) DEFAULT 0,
  patient_id    INT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinician_id) REFERENCES clinicians(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id)   REFERENCES patients(id)   ON DELETE SET NULL
);

-- 10. invitation_medications — medications pre-loaded with an invitation
CREATE TABLE IF NOT EXISTS invitation_medications (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  invitation_id    INT NOT NULL,
  name             VARCHAR(255) NOT NULL,
  dosage           VARCHAR(100) NOT NULL,
  dosage_metric    VARCHAR(50)  NOT NULL DEFAULT 'mg',
  frequency_when   VARCHAR(100) NOT NULL DEFAULT 'once',
  frequency_period VARCHAR(100) NOT NULL DEFAULT 'daily',
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);
