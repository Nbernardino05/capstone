-- Migration: Create medication_logs table for US 14 (dose logging)

CREATE TABLE IF NOT EXISTS medication_logs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  patient_id    INT NOT NULL,
  medication_id INT NOT NULL,
  logged_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)    REFERENCES patients(id)    ON DELETE CASCADE,
  FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
);
