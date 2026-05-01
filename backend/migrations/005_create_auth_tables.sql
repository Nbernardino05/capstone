-- Migration 005: Auth tables for clinicians and patients

CREATE TABLE IF NOT EXISTS clinicians (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  practice   VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE patients
  ADD COLUMN clinician_id INT,
  ADD CONSTRAINT fk_patient_clinician
    FOREIGN KEY (clinician_id) REFERENCES clinicians(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS patient_users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL UNIQUE,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);
