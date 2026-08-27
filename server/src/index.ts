import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './db/index.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

async function start() {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`CampusOS API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // Finish in-flight requests before the process exits.
  const shutdown = (signal: string) => async () => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled promise rejection'));
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
