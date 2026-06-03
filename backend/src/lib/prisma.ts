import { PrismaClient } from '@prisma/client';

// Singleton pattern — prevents multiple Prisma Client instances during
// development hot-reloads (tsx watch restarts the module but the singleton
// persists in the Node.js module cache).
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
