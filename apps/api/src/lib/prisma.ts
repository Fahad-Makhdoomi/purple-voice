import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var __pvPrisma: PrismaClient | undefined;
}

/** One client per process; tsx watch reloads reuse it instead of leaking pools. */
export const prisma: PrismaClient =
  globalThis.__pvPrisma ??
  new PrismaClient({
    log: env.isProd ? ['error'] : ['error', 'warn'],
  });

if (!env.isProd) globalThis.__pvPrisma = prisma;
