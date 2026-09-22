import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../config/db.js';
import { signToken } from '../utils/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { logger } from '../utils/logger.js';
import { isLocked, recordFailedLogin, clearFailures } from '../utils/loginLockout.js';

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// bcrypt cost 12 (~300ms/work factor) — deliberate above the OWASP minimum of 10 for password hashes.
const BCRYPT_COST = 12;

// Login is made constant-time for unknown emails (bcrypt still runs against a dummy hash) so the
// response time does not reveal whether an account exists.
let timingDummyHash;
function dummyPasswordHash() {
  if (!timingDummyHash) timingDummyHash = bcrypt.hashSync('timing-equalization-password', BCRYPT_COST);
  return timingDummyHash;
}

// Role is NEVER accepted from the client — newly registered accounts are always landlords.
// Privileged roles (admin/manager) are granted by an existing admin (or via seed), never self-service.
const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const googleAuthSchema = z.object({
  credential: z.string().min(20),
});

async function verifyGoogleCredential(credential) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.email_verified) {
    throw new Error('Google account could not be verified');
  }

  return payload;
}

function authUserResponse(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
    auth_provider: user.auth_provider,
  };
}

router.use(authLimiter);
router.post('/register', async (req, res) => {
  try {
    const payload = registerSchema.parse(req.body);

    const existing = await query('SELECT id FROM users WHERE email = $1', [payload.email.toLowerCase()]);
    if (existing.rows.length > 0) {
      // Deliberately vague: revealing whether an email is registered lets attackers enumerate users.
      logger.info({ email: payload.email.toLowerCase() }, 'Registration attempt for existing email');
      return res.status(409).json({ message: 'Unable to register with this email address.' });
    }

    const passwordHash = await bcrypt.hash(payload.password, BCRYPT_COST);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, created_at)
       VALUES ($1, $2, $3, 'landlord', NOW())
       RETURNING id, name, email, role, created_at, token_version`,
      [payload.name, payload.email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];
    const token = signToken({ sub: user.id, email: user.email, role: user.role, name: user.name, tv: user.token_version });

    return res.status(201).json({ token, user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    // users.email is UNIQUE — a concurrent registration for the same email surfaces as 23505 after
    // the up-front check passed (check-then-insert race). Treat it exactly like the pre-check.
    if (error?.code === '23505') {
      logger.info('Concurrent registration for an existing email');
      return res.status(409).json({ message: 'Unable to register with this email address.' });
    }

    logger.error({ err: error.message }, 'Registration failed');
    return res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const payload = loginSchema.parse(req.body);
    const email = payload.email.toLowerCase();

    if (isLocked(email)) {
      // Locked accounts are rejected before any bcrypt work — the timing difference is an acceptable
      // and expected signal for a lockout, same as other systems.
      return res.status(429).json({ message: 'Too many failed attempts — try again later' });
    }

    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      // Same bcrypt work as a real login so response timing doesn't leak whether the email exists.
      await bcrypt.compare(payload.password, dummyPasswordHash());
      recordFailedLogin(email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(payload.password, user.password_hash);
    if (!valid) {
      recordFailedLogin(email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    clearFailures(email);

    const token = signToken({ sub: user.id, email: user.email, role: user.role, name: user.name, tv: user.token_version });

    return res.json({
      token,
      user: authUserResponse(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    return res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const payload = googleAuthSchema.parse(req.body);
    const googleProfile = await verifyGoogleCredential(payload.credential);
    const email = googleProfile.email.toLowerCase();

    let result = await query('SELECT * FROM users WHERE email = $1', [email]);
    let user = result.rows[0];

    if (!user) {
      const fallbackPassword = await bcrypt.hash(`google-oauth-${email}-${Date.now()}`, BCRYPT_COST);
      result = await query(
        `INSERT INTO users (name, email, password_hash, role, auth_provider, google_sub, created_at)
         VALUES ($1, $2, $3, $4, 'google', $5, NOW())
         RETURNING *`,
        [
          googleProfile.name || googleProfile.given_name || email.split('@')[0],
          email,
          fallbackPassword,
          'landlord',
          googleProfile.sub,
        ]
      );
      user = result.rows[0];
    } else if (!user.google_sub) {
      if (String(user.password_hash).startsWith('google-oauth-')) {
        // Legacy Google-created account without a linked sub — safe to bind the verified identity.
        await query(
          'UPDATE users SET auth_provider = $1, google_sub = $2, updated_at = NOW() WHERE id = $3',
          ['google', googleProfile.sub, user.id]
        );
        user = { ...user, auth_provider: 'google', google_sub: googleProfile.sub };
      } else {
        // Password account: never auto-bind an arbitrary Google identity (account-takeover vector).
        // No token is issued — the user must sign in with their password (explicit linking later).
        return res.status(403).json({ message: 'An account with this email already uses a password. Sign in with your password to connect Google later.' });
      }
    } else if (user.google_sub !== googleProfile.sub) {
      return res.status(403).json({ message: 'This Google account is not linked to this account. Sign in another way.' });
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role, name: user.name, tv: user.token_version });

    return res.json({
      token,
      user: authUserResponse(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    return res.status(401).json({ message: 'Google authentication failed' });
  }
});

// Server-side logout: revoke every token this user has ever been issued by bumping token_version.
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await query('UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1', [req.user.sub]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: 'Logout failed' });
  }
});

export default router;
