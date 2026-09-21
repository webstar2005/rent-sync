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

// Warn if using default/insecure secrets in non-dev
if (process.env.JWT_SECRET && /change_this_secret|dev_secret/.test(process.env.JWT_SECRET) && nodeEnv === 'production') {
  throw new Error('JWT_SECRET is still the default placeholder — set a strong random value via secret manager for production');
}

export const env = {
  NODE_ENV: nodeEnv,
  PORT: Number(process.env.PORT || 4000),
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  MPESA_ENVIRONMENT: process.env.MPESA_ENVIRONMENT,
  MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET,
  MPESA_PASSKEY: process.env.MPESA_PASSKEY,
  MPESA_SHORTCODE: process.env.MPESA_SHORTCODE,
  MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL,
  MPESA_TIMEOUT_URL: process.env.MPESA_TIMEOUT_URL,
  PAYHERO_BASE_URL: process.env.PAYHERO_BASE_URL,
  PAYHERO_AUTH_TOKEN: process.env.PAYHERO_AUTH_TOKEN,
  PAYHERO_ACCOUNT_ID: process.env.PAYHERO_ACCOUNT_ID,
  PAYHERO_WEBHOOK_SECRET: process.env.PAYHERO_WEBHOOK_SECRET,
  PAYHERO_IP_ALLOWLIST: process.env.PAYHERO_IP_ALLOWLIST,
  PAYHERO_LOW_BALANCE_ALERT: process.env.PAYHERO_LOW_BALANCE_ALERT,
};
