-- Migration 006: Invitation codes and pre-loaded medications

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
