// ============================================================
// TELECAL — PRISMA CLIENT SINGLETON
// One instance shared across the entire server.
// Prevents connection pool exhaustion in development
// where hot-reloads would otherwise create new instances.
// ============================================================

import { PrismaClient } from '@prisma/client';
import { config, isDev } from '../config';
import { logger } from './logger';

const prismaLogLevels = isDev
  ? (['query', 'info', 'warn', 'error'] as const)
  : (['warn', 'error'] as const);

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: prismaLogLevels.map((level) => ({
      emit: 'event',
      level,
    })),
  });

  if (isDev) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).$on('query', (e: { query: string; duration: number }) => {
      if (e.duration > 500) {
        logger.warn('Slow query detected', {
          query: e.query,
          durationMs: e.duration,
        });
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).$on('error', (e: { message: string }) => {
    logger.error('Prisma error', { message: e.message });
  });

  return client;
};

// Global singleton pattern — safe across hot reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var __prisma: ReturnType<typeof prismaClientSingleton> | undefined;
}

export const prisma = global.__prisma ?? prismaClientSingleton();

if (config.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// ─── Graceful shutdown ────────────────────────────────────────

export const disconnectPrisma = async () => {
  await prisma.$disconnect();
  logger.info('Database connection closed');
};
