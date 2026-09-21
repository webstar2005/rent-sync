import { app, pool } from './app.js';
import { logger, alertError } from './utils/logger.js';

// Graceful startup: verify DB before listening (fail fast in prod, warn in dev)
let server;
async function start() {
  try {
    const { query } = await import('./config/db.js');
    await query('SELECT 1');
    logger.info({ env: process.env.NODE_ENV, port: process.env.PORT || 4000 }, 'Database connected');
  } catch (err) {
    logger.error({ err: err.message }, 'Database health check failed at startup');
    alertError('startup_db_failed', err);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      logger.warn('Continuing without DB in development — /health will be 503 until DB is back');
    }
  }

  server = app.listen(process.env.PORT || 4000, () => {
    logger.info(`Backend listening on http://localhost:${process.env.PORT || 4000} (env=${process.env.NODE_ENV})`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error({ port: process.env.PORT || 4000, err: err.message }, `Port ${process.env.PORT || 4000} already in use (stale backend?) — trying to recover`);
      alertError('port_in_use', err);
      // Try to recover: wait 2s and retry once (handles stale port from previous crash)
      setTimeout(() => {
        logger.info('Retrying listen after EADDRINUSE...');
        server.close(() => {
          server = app.listen(process.env.PORT || 4000, () => {
            logger.info(`Backend recovered and listening on http://localhost:${process.env.PORT || 4000}`);
          });
          server.on('error', (e) => {
            logger.error({ err: e.message }, 'Second listen failed — exiting. Run: taskkill /F /IM node.exe or lsof -ti:4000 | xargs kill');
            alertError('port_in_use_second_fail', e);
            process.exit(1);
          });
        });
      }, 2000);
    } else {
      logger.error({ err }, 'Server error');
      alertError('server_error', err);
    }
  });
}

start();

// Graceful shutdown + error logging
function shutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully');
  if (server) {
    server.close(async () => {
      try {
        await pool.end();
        logger.info('Pool closed, exiting');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error closing pool');
        process.exit(1);
      }
    });
    // Force close after 10s
    setTimeout(() => {
      logger.warn('Forced shutdown after 10s');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  alertError('unhandled_rejection', reason instanceof Error ? reason : new Error(String(reason)));
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  alertError('uncaught_exception', err);
  shutdown('uncaughtException');
});