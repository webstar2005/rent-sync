# Rent Sync — Property App (Vite + Supabase)

Separate from the marketing site (`../` — Next.js). This is the logged-in SPA behind auth (`docs/PLAN.md 11`).

- Frontend: **Vite + React + TypeScript** — no SSR needed, SPA is simpler
- Backend: **Supabase** — Postgres, Auth, Edge Functions, Storage
- Styling: **Tailwind 4** — shared burgundy/ink tokens with marketing site
- Branding: black+burgundy same as `../DESIGN.md`

## Phase 0 — Environments + CI/CD

Per `docs/PLAN.md 11.8` — done before any feature code:

1. Three Supabase projects: **dev / staging / prod** (create in dashboard or via CLI)
2. Secrets via `.env` locally (see `.env.example`) + hosting env vars
3. Migrations versioned in `supabase/migrations/`
4. CI `.github/workflows/ci.yml` runs `tsc -b`, `oxlint`, `test:rls` placeholder, `vite build` on every PR

```bash
cp .env.example .env
# fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

npm install
npm run dev   # http://localhost:5173
npm run build
```

Next: **Phase 1 — Data Model + RLS** (`docs/PLAN.md 11.2-11.3`) — schema + policies + cross-tenant tests (no UI till reviewed).
