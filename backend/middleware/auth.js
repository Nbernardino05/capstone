const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;

function requireClinician(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'clinician') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.clinicianId = payload.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requirePatient(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'patient') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.patientId = payload.patientId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { requireClinician, requirePatient, JWT_SECRET };
