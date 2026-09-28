import pino from 'pino';
import pinoHttp from 'pino-http';
import fs from 'node:fs';
import path from 'node:path';

// Ensure logs directory exists in production for persistent logs
if (process.env.NODE_ENV === 'production') {
  try {
    fs.mkdirSync(path.resolve(process.cwd(), 'logs'), { recursive: true });
  } catch {}
}

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport:
    process.env.NODE_ENV === 'production'
      ? {
          targets: [
            { target: 'pino/file', options: { destination: path.resolve(process.cwd(), 'logs/app.log'), mkdir: true } },
            { target: 'pino/file', options: { destination: 1 } }, // stdout
          ],
        }
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
});

// Query keys whose values must never reach a log sink. The PayHero callback carries the account's
// live webhook secret in the query string (see payhero.js payheroCallbackUrl), and that secret would
// otherwise be written verbatim to Render's log stream and to the on-disk log file.
const SENSITIVE_QUERY_KEYS = new Set([
  'secret', 'token', 'password', 'passwd', 'api_key', 'apikey',
  'access_token', 'refresh_token', 'signature', 'sig', 'key',
]);

// Masks the values of sensitive query parameters while keeping the rest of the URL (path, status
// params, ids) intact, because the path and parameter names are what make a log line diagnosable.
// Non-string/empty input passes through so a missing url never turns into the string "undefined".
export function redactUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) return rawUrl;
  const q = rawUrl.indexOf('?');
  if (q === -1) return rawUrl;
  const path = rawUrl.slice(0, q);
  const query = rawUrl.slice(q + 1);
  if (query.length === 0) return path;
  const pairs = query.split('&').map((pair) => {
    const eq = pair.indexOf('=');
    if (eq === -1) return pair;
    const key = pair.slice(0, eq);
    let decodedKey = key;
    try { decodedKey = decodeURIComponent(key); } catch { /* keep raw key */ }
    return SENSITIVE_QUERY_KEYS.has(decodedKey.toLowerCase()) ? `${key}=[redacted]` : pair;
  });
  return `${path}?${pairs.join('&')}`;
}

// Also log to file for failed requests in production (captured separately below)
export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    // url goes through redactUrl: a raw req.url would log the PayHero webhook secret.
    req: (req) => ({ method: req.method, url: redactUrl(req.url), id: req.id, ip: req.ip }),
    res: (res) => ({ statusCode: res.statusCode }),
    err: pino.stdSerializers.err,
  },
});

// Helper for crash alerts — in production you would wire to Sentry/OpsGenie/Slack
export function alertError(context, error) {
  // Always log structurally
  logger.error({ context, err: error, stack: error?.stack }, `ALERT: ${context}`);
  // Placeholder: integrate Sentry.captureException(error) or webhook here
  // if (process.env.SENTRY_DSN) Sentry.captureException(error, { extra: { context } });
}
