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

// Also log to file for failed requests in production (captured separately below)
export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url, id: req.id, ip: req.ip }),
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
