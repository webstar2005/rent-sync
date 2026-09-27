import { verifyToken } from '../utils/auth.js';
import { query } from '../config/db.js';
import { logger } from '../utils/logger.js';

// Authenticates the JWT and then re-validates against the live user row on EVERY request:
//   - role comes from the DB, so a role change takes effect immediately (the JWT claim is not trusted)
//   - token_version matches the JWT `tv` claim, so /logout revokes every previously issued token
//   - is_active is enforced, so a quietly deactivated user is locked out at once
//   - subscription_status rides along for requirePaid, so switching a subscription on takes effect
//     on the very next request without the user having to sign in again, and at no extra query cost
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid authorization header' });
  }

  let decoded;
  try {
    decoded = verifyToken(authHeader.split(' ')[1]);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    const result = await query(
      `SELECT id, name, email, role, auth_provider, token_version,
              subscription_status, plan, units_limit, activated_at
       FROM users WHERE id = $1 AND is_active = TRUE`,
      [decoded.sub]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Account is inactive or no longer exists' });
    }
    // Tokens issued before token_version existed carry no `tv` — accept once; v1 tokens and up are checked.
    if (decoded.tv !== undefined && decoded.tv !== user.token_version) {
      return res.status(401).json({ message: 'Session has been revoked — sign in again' });
    }

    req.user = {
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      auth_provider: user.auth_provider,
      // Carried here so requirePaid can gate the product without a second query on every request.
      subscription_status: user.subscription_status,
      plan: user.plan,
      units_limit: user.units_limit,
      activated_at: user.activated_at,
    };
    next();
    } catch (error) {
      // Logged, not swallowed: this failed silently as a bare 500 on every authenticated route when
      // the users table was missing a column, which cost a long debugging session to trace.
      logger.error({ err: error.message }, 'Authentication check failed');
      return res.status(500).json({ message: 'Authentication check failed' });
    }
}