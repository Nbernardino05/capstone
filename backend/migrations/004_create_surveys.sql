-- Migration: Create check-in survey tables for US 17

CREATE TABLE IF NOT EXISTS check_in_surveys (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  patient_id    INT NOT NULL,
  survey_date   DATE NOT NULL,
  submitted_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  UNIQUE KEY uq_patient_date (patient_id, survey_date)
);

-- One row per medication rated in a given survey
CREATE TABLE IF NOT EXISTS survey_responses (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  survey_id       INT NOT NULL,
  medication_id   INT NOT NULL,
  medication_name VARCHAR(255) NOT NULL,
  efficacy_rating INT NOT NULL,        -- 1–5 scale
  side_effects    TEXT DEFAULT NULL,   -- comma-separated list
  FOREIGN KEY (survey_id)    REFERENCES check_in_surveys(id) ON DELETE CASCADE,
  FOREIGN KEY (medication_id) REFERENCES medications(id)     ON DELETE CASCADE
);
