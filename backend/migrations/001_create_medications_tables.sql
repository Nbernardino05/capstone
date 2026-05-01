-- Migration: Create patients and medications tables

CREATE TABLE IF NOT EXISTS patients (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed: one patient for development/demo
INSERT INTO patients (id, name) VALUES (1, 'Demo Patient')
  ON DUPLICATE KEY UPDATE name = name;

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

-- Seed: provider-added medications for patient 1 (matches US 11 wireframe)
INSERT INTO medications (patient_id, name, dosage, dosage_metric, frequency_when, frequency_period, source, status)
VALUES
  (1, 'Adderall XR', '20',  'mg', 'once', 'morning', 'provider', 'active'),
  (1, 'Wellbutrin',  '150', 'mg', 'once', 'nightly', 'provider', 'active');
