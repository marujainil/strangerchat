import http from 'http';
import { createApp } from './app';
import { createSocketServer } from './socket';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { redis } from './config/redis';
import { logger } from './utils/logger';

async function main() {
  const app = createApp();
  const server = http.createServer(app);
  createSocketServer(server);

  server.listen(env.PORT, () => {
    logger.info(`StrangerChat API listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    server.close();
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (r) => logger.error('unhandledRejection', { r: String(r) }));
}

main().catch((e) => {
  logger.error('fatal boot error', { e: (e as Error).message });
  process.exit(1);
});
