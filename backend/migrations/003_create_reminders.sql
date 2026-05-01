-- Migration: Create reminders table for US 16 (medication reminders)

CREATE TABLE IF NOT EXISTS reminders (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  patient_id      INT NOT NULL,
  medication_id   INT NOT NULL,
  reminder_time   VARCHAR(5) NOT NULL,  -- HH:MM (24-hour)
  enabled         TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)    REFERENCES patients(id)    ON DELETE CASCADE,
  FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
  UNIQUE KEY uq_patient_med (patient_id, medication_id)
);
