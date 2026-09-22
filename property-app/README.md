# Rent Sync — Property App (Vite + React + Express + PostgreSQL)

Separate from the marketing site (`../` — Next.js). This is the logged-in SPA behind auth (`docs/PLAN.md 11`).

- Frontend: **Vite + React + TypeScript** — no SSR needed, SPA is simpler
- Backend: **Node.js + Express + PostgreSQL** — local `backend/` (see `backend/README.md`)
- Payments: **PayHero** (Paybill / Till / Bank collection channels + incoming-payment webhooks)
- Styling: **Tailwind 4** — shared burgundy/ink tokens with marketing site
- Branding: black+burgundy same as `../DESIGN.md`

## Setup

Secrets via `backend/.env` (see `backend/.env.example`) + the client's `.env`.

```bash
npm install
npm run dev   # http://localhost:5173 (backend on :4000 — see backend/README.md)
npm run build
```

Database schema lives in `backend/database/schema.sql`, with versioned re-runnable migrations in `backend/database/migrations/`. Backend tests run against a separate test Postgres (`DATABASE_URL_TEST`, see `backend/README.md`).