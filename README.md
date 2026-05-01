# MedTracker

A medication management system with three components:

| Component          | Stack                     | Default port |
| ------------------ | ------------------------- | ------------ |
| `backend/`         | Node.js / Express / MySQL | 4000         |
| `provider-portal/` | Next.js                   | 3000         |
| `mobile/`          | React Native / Expo       | —            |

---

## Prerequisites

- **Node.js** v18 or later
- **MySQL** 8.0 or later (running locally)
- **Expo Go** iOS Simulator app or on your phone,
- **Expo CLI**: `npm install -g expo-cli` (only needed if `npx expo` doesn't work)

---

## 1 — Clone the repo

```bash
git clone https://github.com/Nbernardino05/capstone.git
cd capstone
```

---

## 2 — Set up the database

### 2a. Create the backend environment file

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your MySQL credentials:

```
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=capstone
PORT=4000
JWT_SECRET=<paste a long random string here>
ALLOWED_ORIGINS=http://localhost:3000
```

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### 2b. Run the setup script

```bash
cd backend
npm install
npm run db:setup
```

This creates the `capstone` database, all tables, and two demo accounts:

| Role      | Email                      | Password     |
| --------- | -------------------------- | ------------ |
| Clinician | demo.clinician@example.com | Password123! |
| Patient   | demo.patient@example.com   | Password123! |

---

## 3 — Start the backend

```bash
# inside backend/
npm start
```

The API is now running at `http://localhost:4000`.  
Test it: `curl http://localhost:4000/api/health` (or open in a browser — you should get a response).

---

## 4 — Set up the provider portal

```bash
cd ../provider-portal
npm install
```

Create the environment file:

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
```

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000` and log in with the demo clinician credentials:

- **Email**: demo.clinician@example.com
- **Password**: Password123!

---

## 5 — Set up the mobile app

```bash
cd ../mobile
npm install
npx expo start
```

### iOS Simulator

Press `i` in the Expo terminal. The app connects to `localhost:4000` automatically.

Log in with the demo patient credentials:

- **Email**: demo.patient@example.com
- **Password**: Password123!

---

## Running tests

```bash
# Backend
cd backend && npm test

# Provider portal
cd provider-portal && npm test

# Mobile
cd mobile && npm test
```

---

## Project structure

```
capstone/
├── backend/
│   ├── db/
│   │   ├── schema.sql      # consolidated schema (all 10 tables)
│   │   └── setup.js        # run via npm run db:setup
│   ├── migrations/         # incremental migration history
│   ├── routes/
│   ├── middleware/
│   └── index.js
├── provider-portal/        # Next.js clinician dashboard
│   └── src/app/
└── mobile/                 # Expo patient app
    └── src/
```
