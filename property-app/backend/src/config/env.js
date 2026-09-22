import dotenv from 'dotenv';
import path from 'node:path';

// Load per NODE_ENV: .env, .env.development, .env.staging, .env.production
// dotenv will not override already-set env (host secret manager wins)
const nodeEnv = process.env.NODE_ENV || 'development';
const envFiles = ['.env', `.env.${nodeEnv}`];

for (const file of envFiles) {
  dotenv.config({ path: path.resolve(process.cwd(), file), override: false });
}

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k] || String(process.env[k]).trim() === '');

if (missing.length > 0) {
  // Fail fast in production, warn in dev
  const msg = `Missing required env vars: ${missing.join(', ')}. See .env.example and set via secret manager (Render/Railway/AWS Secrets Manager) — never hardcode.`;
  if (nodeEnv === 'production') {
    throw new Error(msg);
  } else {
    console.warn(`[env] ${msg}`);
  }
}

// Validate DATABASE_URL looks like postgres
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
  console.warn('[env] DATABASE_URL should start with postgresql://');
}

// Production secrets guard: fail fast if any secret is missing, weak, or still a placeholder. The
// placeholder check must match EVERY default value we ship (including .env / .env.production).
const WEAK_JWT_SECRETS = /change_this_secret|dev_secret|property_app_dev_secret_change_me|__SET_VIA_SECRET_MANAGER__/;

if (nodeEnv === 'production') {
  const prodRequired = ['DATABASE_URL', 'JWT_SECRET', 'CRON_SECRET', 'PAYHERO_WEBHOOK_SECRET'];
  const prodMissing = prodRequired.filter((k) => !process.env[k] || String(process.env[k]).trim() === '');
  if (prodMissing.length > 0) {
    throw new Error(`Missing required production env vars: ${prodMissing.join(', ')}. Set via secret manager (Render/Railway/AWS Secrets Manager) — never hardcode.`);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret.length < 32 || WEAK_JWT_SECRETS.test(jwtSecret)) {
    throw new Error('JWT_SECRET is missing, too short (< 32 chars), or still a default placeholder — set a strong random value via secret manager for production');
  }
  if (String(process.env.CRON_SECRET).length < 16) {
    throw new Error('CRON_SECRET must be at least 16 characters in production');
  }
  if (String(process.env.PAYHERO_WEBHOOK_SECRET).length < 16) {
    throw new Error('PAYHERO_WEBHOOK_SECRET must be at least 16 characters in production');
  }
} else if (process.env.JWT_SECRET && (String(process.env.JWT_SECRET).length < 32 || WEAK_JWT_SECRETS.test(process.env.JWT_SECRET))) {
  console.warn(`[env] JWT_SECRET looks weak or is a known placeholder — set a strong random value for anything beyond local development`);
}

export const env = {
  NODE_ENV: nodeEnv,
  PORT: Number(process.env.PORT || 4000),
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  PAYHERO_BASE_URL: process.env.PAYHERO_BASE_URL,
  PAYHERO_AUTH_TOKEN: process.env.PAYHERO_AUTH_TOKEN,
  PAYHERO_ACCOUNT_ID: process.env.PAYHERO_ACCOUNT_ID,
  PAYHERO_WEBHOOK_SECRET: process.env.PAYHERO_WEBHOOK_SECRET,
  PAYHERO_IP_ALLOWLIST: process.env.PAYHERO_IP_ALLOWLIST,
  PAYHERO_LOW_BALANCE_ALERT: process.env.PAYHERO_LOW_BALANCE_ALERT,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
};
