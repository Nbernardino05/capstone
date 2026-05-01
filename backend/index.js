const express = require('express');
const cors = require('cors');
require('dotenv').config();

const medicationRoutes = require('./routes/medications');
const surveyRoutes = require('./routes/surveys');
const authRoutes = require('./routes/auth');
const clinicianRoutes = require('./routes/clinician');

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

app.use('/api', authRoutes);
app.use('/api', clinicianRoutes);
app.use('/api', medicationRoutes);
app.use('/api', surveyRoutes);

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});
