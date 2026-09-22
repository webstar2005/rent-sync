# Rent Sync — HostAfrica VPS Deployment Guide

Deploys the Rent Sync platform to a HostAfrica Ubuntu VPS with Node 22, PostgreSQL 16, and Caddy
(auto HTTPS). The production secrets stay out of the repo — they are created on the server and set
via the host's secret manager (env vars / `.env.production` on disk).

## What's deployed

| Target | Repo folder | Runs as | Address |
|---|---|---|---|
| Marketing site | `package.json` (Next.js SSR) | node `next start` :3001 | `rentsync.africa` / `www` |
| Dashboard (client) | `property-app/` (Vite + React) | static `dist/` | `app.rentsync.africa` |
| API backend | `property-app/backend/` (Express + PG) | node :4000 | `api.rentsync.africa` |

## Prerequisites

- HostAfrica VPS: Ubuntu 24.04 LTS, 2 GB+ RAM, public IP (use `102.x.x.x` below for the examples).
- Domain `rentsync.africa` registered at HostAfrica (already done).
- Your Windows machine with OpenSSH client (`ssh` on PATH).

---

## 1. DNS — HostAfrica domain panel

Add four `A` records for `rentsync.africa` pointing at the VPS IP (propagates within minutes,
up to 24h):

```
@        A  102.x.x.x
www      A  102.x.x.x
app      A  102.x.x.x
api      A  102.x.x.x
```

## 2. Code prep (on your machine, before upload)

- The dashboard `CSP` in `property-app/index.html` already allows `https://api.rentsync.africa` in
  `connect-src` — do not remove it.
- The dashboard also needs `VITE_API_BASE_URL=https://api.rentsync.africa` **at build time** (step 7).
  If that is omitted, the production build falls back to same-origin (`/api/*`), which will not work
  on a separate `api.` subdomain.

## 3. One-time VPS setup

```powershell
ssh root@102.x.x.x
```

```bash
apt update && apt upgrade -y
apt install -y curl git postgresql postgresql-contrib sudo ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
node -v && npm -v    # expect v22.x
```

Firewall (only SSH, HTTP, HTTPS):

```bash
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

## 4. PostgreSQL — database and user

```bash
sudo -u postgres psql
```

```sql
CREATE USER rentsync WITH PASSWORD 'REPLACE_WITH_STRONG_DB_PASSWORD';
CREATE DATABASE rentsync_prod OWNER rentsync;
GRANT ALL PRIVILEGES ON DATABASE rentsync_prod TO rentsync;
\q
```

Apply the schema, then every migration, **in that order** (the app does NOT auto-migrate in prod —
this is done once here; migrations are written to be re-runnable):

```bash
cd /opt/rentsync/property-app/backend/database   # after step 5 upload
sudo -u postgres psql -d rentsync_prod -f schema.sql
cd migrations
for f in *.sql; do sudo -u postgres psql -d rentsync_prod -f "$f"; done
```

## 5. Upload the code (from your Windows machine)

`tar` over SSH skips `node_modules`, builds and git — install deps on the server instead:

```powershell
cd C:\Users\Admin\Pictures\marketing-site
tar --exclude=node_modules --exclude=.next --exclude=dist --exclude=.git -czf - property-app package.json | ssh root@102.x.x.x "mkdir -p /opt/rentsync && tar -xzf - -C /opt/rentsync"
```

## 6. Backend — deps, secrets, systemd

```bash
cd /opt/rentsync/property-app/backend
npm install
nano .env.production
```

`.env.production` (create with editor; never commit this file):

```
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://rentsync:REPLACE_WITH_STRONG_DB_PASSWORD@localhost:5432/rentsync_prod
JWT_SECRET=<gen 64 hex via: powershell [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()>
CRON_SECRET=<gen 64 hex>
PAYHERO_WEBHOOK_SECRET=<gen 64 hex>
PAYHERO_AUTH_TOKEN=<fresh token from PayHero portal — do not reuse the dev .env value>
PAYHERO_ACCOUNT_ID=12406
GOOGLE_CLIENT_ID=<your OAuth client id>
CORS_ORIGIN=https://app.rentsync.africa
LOG_LEVEL=info
```

> The `env.js` production guard fails startup if `DATABASE_URL`, a `<32-char` or placeholder
> `JWT_SECRET`, `<16-char` `CRON_SECRET`, or `<16-char` `PAYHERO_WEBHOOK_SECRET` is set — a
> misconfigured deploy fails loudly. CORS is fail-closed too: no cross-origin requests until
> `CORS_ORIGIN` is set.

systemd unit:

```bash
nano /etc/systemd/system/rentsync-api.service
```

```ini
[Unit]
Description=Rent Sync API
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/rentsync/property-app/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/server.js
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now rentsync-api
systemctl status rentsync-api
curl http://localhost:4000/health/db    # expect 200 JSON
```

## 7. Dashboard — build with the API URL

```bash
cd /opt/rentsync/property-app
npm install
VITE_API_BASE_URL=https://api.rentsync.africa NODE_ENV=production npm run build
```

Output lands in `dist/` and is served as static files by Caddy (step 9). If the API domain ever
changes, rebuild with the new value.

## 8. Marketing site (Next.js SSR)

```bash
cd /opt/rentsync
npm install
npm run build
```

systemd unit (Next runs on 3001; Caddy fronts it):

```bash
nano /etc/systemd/system/rentsync-marketing.service
```

```ini
[Unit]
Description=Rent Sync marketing site
After=network.target

[Service]
WorkingDirectory=/opt/rentsync
Environment=PORT=3001
ExecStart=/usr/bin/env node_modules/.bin/next start -p 3001
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now rentsync-marketing
```

## 9. Caddy — TLS + routing

`/etc/caddy/Caddyfile` (and its `Caddyfile` BLANK the default first):

```
rentsync.africa, www.rentsync.africa {
    reverse_proxy localhost:3001
}

app.rentsync.africa {
    root * /opt/rentsync/property-app/dist
    encode gzip
    file_server
}

api.rentsync.africa {
    reverse_proxy localhost:4000
    request_body {
        max_size 2MB
    }
}
```

```bash
apt install -y caddy
caddy reload --config /etc/caddy/Caddyfile
```

Caddy requests Let's Encrypt certificates automatically once DNS points at the server.

## 10. Verify + reconnect integrations

- DNS + HTTPS: `https://api.rentsync.africa/health` (200), `https://app.rentsync.africa` (login
  flow works), `https://rentsync.africa` (marketing loads).
- **PayHero**: callback URL → `https://api.rentsync.africa/webhooks/payhero`, secret sent via the
  `x-payhero-webhook-secret` header. A callback without that header must be answered with **403**
  (the webhook is fail-closed).
- **Cron**: point a scheduler (cron-job.org, GitHub Actions, server cron) at
  `POST https://api.rentsync.africa/api/cron/invoices` with header `x-cron-secret: <CRON_SECRET>`.

## Security rules on the server

- `.env.production` and the DB password must never enter git, chat, screenshots, or archives.
- Rotate `PAYHERO_AUTH_TOKEN`, DB password, and the three secrets only if something leaks; use a
  secret manager (e.g. `systemd-import-environment`, docker secrets, or a vault) once you outgrow
  a single server.
- Never copy the local dev `property-app/backend/.env` to the server — it holds sandbox/sample values.
- Backups: `pg_dump rentsync_prod` nightly (cron + copy to a second location).

## Troubleshooting

- Service died: `journalctl -u rentsync-api -e` / `-u rentsync-marketing -e`.
- App refuses to start: read the top of the log — the production env guard explains exactly which
  variable is missing/weak.
- DNS not resolving: `nslookup api.rentsync.africa`; confirm the four `A` records exist.
- Certificate pending: Caddy retries on its own; `/var/log/caddy/` has details.