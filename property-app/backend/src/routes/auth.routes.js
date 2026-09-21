import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../config/db.js';
import { signToken } from '../utils/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'manager', 'landlord']).default('landlord'),
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
      return res.status(400).json({ message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, email, role, created_at`,
      [payload.name, payload.email.toLowerCase(), passwordHash, payload.role]
    );

    const user = result.rows[0];
    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    return res.status(201).json({ token, user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const payload = loginSchema.parse(req.body);

    const result = await query('SELECT * FROM users WHERE email = $1', [payload.email.toLowerCase()]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(payload.password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    return res.json({
      token,
      user: authUserResponse(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    return res.status(500).json({ message: 'Login failed', error: error.message });
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
      const fallbackPassword = await bcrypt.hash(`google-oauth-${email}-${Date.now()}`, 10);
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
    } else if (!user.google_sub && googleProfile.sub) {
      await query(
        'UPDATE users SET auth_provider = $1, google_sub = $2, updated_at = NOW() WHERE id = $3',
        ['google', googleProfile.sub, user.id]
      );
      user = { ...user, auth_provider: 'google', google_sub: googleProfile.sub };
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    return res.json({
      token,
      user: authUserResponse(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    return res.status(401).json({ message: error.message || 'Google authentication failed' });
  }
});

export default router;
