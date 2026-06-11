import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { RegisterInput, LoginInput } from '../schemas/authSchemas';

const BCRYPT_ROUNDS = 10;

// Public-safe user shape — NEVER includes passwordHash.
export function serializeUser(u: User) {
  return {
    id:        u.id,
    name:      u.name,
    email:     u.email,
    role:      u.role,
    avatarUrl: u.avatarUrl,
    language:  u.language,
    notifications: {
      generationComplete: u.notifGenerationComplete,
      factCheckConflict:  u.notifFactCheckConflict,
      draftReady:         u.notifDraftReady,
    },
    createdAt: u.createdAt.toISOString(),
  };
}

export type PublicUser = ReturnType<typeof serializeUser>;

type Result<T> = { ok: true; user: T } | { ok: false; code: 'email_taken' | 'invalid_credentials' };

export const authService = {
  async register(data: RegisterInput): Promise<Result<User>> {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return { ok: false, code: 'email_taken' };

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash },
    });
    return { ok: true, user };
  },

  async login(data: LoginInput): Promise<Result<User>> {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    // Constant-ish behavior: if the user exists but has no password (legacy/seed),
    // or the password is wrong, return the same generic error — no account enumeration.
    if (!user || !user.passwordHash) return { ok: false, code: 'invalid_credentials' };
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return { ok: false, code: 'invalid_credentials' };

    // Touch lastActiveAt on successful login (best-effort, non-blocking semantics).
    await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    return { ok: true, user };
  },

  async getById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },
};
