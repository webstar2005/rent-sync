import express from 'express';
import cors from 'cors';
import './config/env.js'; // validates DATABASE_URL, JWT_SECRET per NODE_ENV, loads .env/.env.<env>
import { env } from './config/env.js';
import { pool, query } from './config/db.js';
import { logger, httpLogger, alertError } from './utils/logger.js';
import { generalLimiter } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.routes.js';
import propertyRoutes from './routes/property.routes.js';
import tenantRoutes from './routes/tenant.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import mpesaRoutes from './routes/mpesa.routes.js';
import reconciliationRoutes from './routes/reconciliation.routes.js';
import cronRoutes from './routes/cron.routes.js';
import channelRoutes from './routes/channel.routes.js';
import payheroWebhookRoutes from './routes/payheroWebhook.routes.js';

const app = express();

app.use(httpLogger);
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
// General abuse protection (100 req / 15 min) — skip health
app.use('/api', generalLimiter);

app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({
      ok: true,
      status: 'healthy',
      message: 'Property app backend is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Health check failed: DB unreachable');
    alertError('health_db_failed', error);
    res.status(503).json({
      ok: false,
      status: 'unhealthy',
      message: 'Database health check failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Liveness — app is up (no DB check, for k8s liveness)
app.get('/health/live', (req, res) => {
  res.json({ ok: true, status: 'live', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Readiness — app + DB + pool ready (for k8s readiness / load balancer)
app.get('/health/ready', async (req, res) => {
  try {
    await query('SELECT 1');
    // also check pool idle count
    const poolState = { totalCount: pool.totalCount, idleCount: pool.idleCount, waitingCount: pool.waitingCount };
    res.json({ ok: true, status: 'ready', pool: poolState, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error({ err: error.message }, 'Readiness check failed');
    alertError('readiness_failed', error);
    res.status(503).json({ ok: false, status: 'not_ready', error: error.message, timestamp: new Date().toISOString() });
  }
});

// Detailed DB health (for monitoring)
app.get('/health/db', async (req, res) => {
  const start = Date.now();
  try {
    await query('SELECT 1');
    const latencyMs = Date.now() - start;
    res.json({ ok: true, status: 'healthy', latencyMs, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error({ err: error.message, latencyMs: Date.now() - start }, 'DB health check failed');
    alertError('db_health_failed', error);
    res.status(503).json({ ok: false, status: 'unhealthy', latencyMs: Date.now() - start, error: error.message, timestamp: new Date().toISOString() });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/payment-channels', channelRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/cron', cronRoutes);
// PayHero incoming payments — the webhook is not behind /api so it does not hit generalLimiter
app.use('/webhooks/payhero', payheroWebhookRoutes);

app.use((err, req, res, next) => {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  alertError('unhandled_error', err);
  res.status(500).json({ message: 'Internal server error' });
});

export { app, pool, env };