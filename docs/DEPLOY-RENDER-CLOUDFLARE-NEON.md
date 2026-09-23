# Rent Sync — Render + Cloudflare Pages + Neon Deployment Guide

The no-VPS path for real clients with once-a-month usage. Total cost **$7/mo** (Render Starter for
the API — the only piece that must never sleep, since it receives PayHero webhooks). Everything
else is free. All secrets stay out of git (see Security notes at the end).

## What's deployed

| Target | Repo folder | Hosts on | Address |
|---|---|---|---|
| Marketing site (Next.js) | repo root, `out/` (static export) | Cloudflare Pages | `rentsync.africa` / `www.rentsync.africa` |
| Dashboard (Vite + React) | `property-app/`, `dist/` | Cloudflare Pages | `app.rentsync.africa` |
| API backend (Express + PG) | `property-app/backend/` | Render Web Service (Node 22, Starter) | `api.rentsync.africa` |
| PostgreSQL | — | Neon (free, scale-to-zero) | via `DATABASE_URL` |

## Repo prep (done — committed already)

- `next.config.ts` has `output: "export"` so the marketing site builds into `out/` for Cloudflare
  Pages (no Node runtime on Pages; no API routes in the site).
- `render.yaml` (repo root) defines the API service with `rootDir: property-app/backend`.

---

## 1. Neon — free Postgres

1. Sign up at neon.tech (GitHub sign-in fine, no card). Create a project (region: closest to you).
2. Copy the **direct** (`-db.`) connection string — for a long-lived Express `pg` pool use the
   direct one, not the `-pooler` one.
3. Paste it into the gitignored `property-app/backend/.env.production`:
   `DATABASE_URL=postgresql://user:pass@ep-xxx-db.neon.tech/neondb?sslmode=require`
4. Apply the schema + migrations **before** first deploy with the included runner (no `psql`
   needed — it uses the backend's `pg` package and mirrors `test/helpers.js`):

```powershell
cd property-app\backend
node scripts/apply-migrations.js
```

It runs `schema.sql` first (it is NOT idempotent — only on a fresh DB), then every migration in
order (all re-runnable). It never runs `seed.sql` (dev sample data). Success looks like:

```
applied schema.sql
applied 002_hardening_indexes_and_due_date.sql
...
Schema + migrations applied successfully.
```

## 2. Render — the API (the $7/mo piece)

Blueprint deploy (recommended): **New + → Blueprint →** select this repo. `render.yaml` covers the
service. Then:

1. Node version **22**.
2. Set the prompted secrets + the vars below on the service's **Environment** tab.

Full production env reference (from `backend/.env.example` + the guard in `src/config/env.js`):

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` |
| `DATABASE_URL` | yes | Neon **direct** connection string |
| `JWT_SECRET` | yes, ≥ 32 chars | `openssl rand -hex 32` |
| `CRON_SECRET` | yes, ≥ 16 chars | guards `POST /api/cron/invoices` (`x-cron-secret` header) |
| `PAYHERO_WEBHOOK_SECRET` | yes, ≥ 16 chars | matches PayHero's `x-payhero-webhook-secret`; webhook fails closed |
| `CORS_ORIGIN` | yes | `https://app.rentsync.africa` (comma-separate extra origins; fail-closed otherwise) |
| `PAYHERO_AUTH_TOKEN` | yes | PayHero portal → API Keys (fresh token, never reuse dev `.env`) |
| `PAYHERO_ACCOUNT_ID` | yes | PayHero profile page (needed to register channels) |
| `LOG_LEVEL` | no | `info` |
| `GOOGLE_CLIENT_ID` | only if Google Sign-In | your OAuth client id |
| `PAYHERO_IP_ALLOWLIST` | no | comma-separated, if you lock the webhook to PayHero IPs |
| `PAYHERO_LOW_BALANCE_ALERT` | no | e.g. `500` (KES) for the service wallet warning |
| `PAYHERO_BASE_URL` | no | defaults to PayHero v2 sandbox/live URL |

Generate secrets on Windows:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

3. Deploy, then verify: hit `/health` on the `*.onrender.com` URL. On first load it may cold-start
(~30 s). Confirm `/health` returns quickly on the second hit.
4. **Upgrade to Starter ($7/mo)** in the service's Settings → Instance Type. This removes spin-down —
  the PayHero webhook will always get an instant response.

## 3. Cloudflare Pages — marketing site

1. New **Pages** project → connect the repo.
2. Build settings: root directory `/`, build command `npm run build`, output directory `out`,
   Node 22.
3. Custom domains: `rentsync.africa` and `www.rentsync.africa` (after §5 DNS move).

## 4. Cloudflare Pages — dashboard SPA

1. New **Pages** project → connect the repo.
2. Build settings: root directory `property-app`, build command `npm run build`, output
   directory `dist`, Node 22.
3. **Environment variable:** `VITE_API_BASE_URL=https://api.rentsync.africa` — without it the
   prod build falls back to same-origin `/api/*` and will not reach the API
   (`property-app/src/lib/api/client.ts`).
4. Custom domain: `app.rentsync.africa`.

## 5. DNS (HostAfrica + Cloudflare)

The apex `rentsync.africa` cannot be a CNAME, and Cloudflare Pages needs CNAME flattening — so
move the domain's nameservers to Cloudflare (free) as part of the Pages setup:

1. In Cloudflare: add `rentsync.africa` (free plan) → it shows four nameservers (`*.ns.cloudflare.com`).
2. In HostAfrica's DNS panel: replace `ns1–ns4.host-ww.net` NS records with Cloudflare's four.
3. On Cloudflare's DNS tab: create **`api` CNAME → `<your-service>.onrender.com`** (proxy OFF), and
   delete the Railway leftovers there if they migrated in: `api` CNAME → `pogmeykd.up.railway.app`
   and the `_railway-verify.api` TXT record.
4. Alternatively: add `api.rentsync.africa` as a custom domain on the Render service instead of a
   CNAME. Either way, keep `VITE_API_BASE_URL` in sync with what actually reaches the API.
5. Optional: move `www`/`app` custom-domain hostnames onto Cloudflare DNS too (Pages does this
   automatically when you attach them in §3/§4).

Allow up to ~24h for NS propagation (usually minutes).

## 6. Monthly billing cron

The system-wide invoice job is `POST https://api.rentsync.africa/api/cron/invoices` with header
`x-cron-secret: <CRON_SECRET>`. Schedule it with any free service (cron-job.org, GitHub Actions)
to run right before month-end / rent-due day. It is idempotent (skips already-billed periods).

## 7. Verify end-to-end

- `https://rentsync.africa` — marketing loads, HTTPS.
- `https://app.rentsync.africa` — register/login works, reads from the API.
- `https://api.rentsync.africa/health` — 200.
- Create a property + tenant + invoice in the dashboard.
- PayHero: callback URL → `https://api.rentsync.africa/webhooks/payhero`, secret via
  `x-payhero-webhook-secret`. A callback WITHOUT that header gets **403** (fail-closed).
- Legacy: an M-Pesa payment lands → payment recorded against the invoice.

## Security notes

- `.env` / `.env.production` are gitignored; set everything via Render's Environment tab / Neon
  dashboard, never commit secrets.
- The production env guard fails startup on missing/weak secrets and the CORS is fail-closed.
- Keep the local dev `backend/.env` values out of prod (they hold sandbox/sample PayHero data).
- Backups: run `pg_dump` on the Neon DB regularly (Neon free includes a 6-hour restore history
  + 1 snapshot; export a manual dump monthly to a second location).

## Troubleshooting

- API restart loop → open Logs; the env guard says exactly which variable is missing/weak.
- `/health` unhealthy → Neon URL wrong, DB not migrated, or CORS misconfigured (health is DB-backed).
- `app.rentsync.africa` can't reach API → check `VITE_API_BASE_URL` on the Pages project AND
  `CORS_ORIGIN` on Render — both must be set.
- DNS not resolving → confirm Cloudflare nameservers are the authoritative ones at HostAfrica.