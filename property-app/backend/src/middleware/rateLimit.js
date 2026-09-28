import rateLimit from 'express-rate-limit';

// General API: 600 req / 15 min per client IP.
//
// Sized for a browser, not a script. The dashboard polls in the background while a landlord watches
// for a payment to land, so a real session spends a large share of its budget on reads that a human
// never initiated; 100/15min throttled paying customers out of their own dashboard. The endpoints
// that actually need to be tight (auth, bulk writes) keep their own limiters.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
});

// Auth: 10 attempts / 15 min (brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts, please try again later' },
});

// Bulk import: 20 / hour (heavy transaction)
export const bulkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many bulk imports, please try again later' },
});

// Payment channel registration: 60 / minute per IP
export const channelLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many callbacks' },
  skip: () => false,
});

// PayHero webhook: 120 / minute per IP — callbacks can arrive in batch; idempotency is handled
// inside the webhook via the transaction_ref unique constraint, not by dropping requests.
export const payheroWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many callbacks' },
  skip: () => false,
});
