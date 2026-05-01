# Provider Portal

Next.js clinician dashboard for MedTracker.

For full project setup (database, backend, mobile), see the [root README](../README.md).

---

## Setup

Requires the backend to be running on port 4000. See [root README → steps 2–3](../README.md).

```bash
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
npm run dev
```

Open `http://localhost:3000`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run Jest tests |
| `npm run lint` | Lint with ESLint |
