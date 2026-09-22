// In-memory per-account login lockout (single-process deployments only — on horizontal scale-out,
// swap this for a shared store such as Redis). It complements the IP-based authLimiter by keying on
// the account itself, so brute force can't be spread across many IPs. Entries expire lazily and the
// Map is bounded, keeping memory self-cleaning without a timer.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // account is blocked 15 min after the 5th consecutive failure
const TTL_MS = 24 * 60 * 60 * 1000; // absolute ceiling for how long a record is retained

const store = new Map(); // normalized email -> { failures, lockedUntil, expiresAt }

export function isLocked(email) {
  if (!email) return false;
  const key = email.trim().toLowerCase();
  const entry = store.get(key);
  if (!entry) return false;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return false;
  }
  return Date.now() < entry.lockedUntil;
}

export function recordFailedLogin(email) {
  if (!email) return 0;
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const prev = store.get(key);
  const entry = prev && now < prev.expiresAt ? prev : { failures: 0, lockedUntil: 0, expiresAt: now + TTL_MS };
  entry.failures += 1;
  if (entry.failures >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  entry.expiresAt = now + TTL_MS;
  store.set(key, entry);
  return Math.max(0, entry.lockedUntil - now);
}

export function clearFailures(email) {
  if (!email) return;
  store.delete(email.trim().toLowerCase());
}