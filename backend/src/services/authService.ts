import bcrypt from 'bcryptjs';
import { Prisma, type User, type WhatsAppIdentity } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { RegisterInput, LoginInput } from '../schemas/authSchemas';
import { generateCode, codeExpiry, maskPhone } from '../lib/whatsappVerification';
import { generateResetToken, hashToken, resetExpiry } from '../lib/passwordReset';

const BCRYPT_ROUNDS = 10;

// Password-reset outcomes. The RAW token is returned ONLY when a user exists, and only
// so the route can email it — it is never persisted or logged.
type ForgotResult =
  | { ok: true; sent: false }                              // no such account — respond generically
  | { ok: true; sent: true; user: User; token: string };  // issued a token to email

type ResetResult =
  | { ok: true }
  | { ok: false; code: 'invalid_or_expired' };

// User with the optional 1:1 WhatsApp identity eagerly loaded (Phase 13B).
const userInclude = { whatsappIdentity: true } satisfies Prisma.UserInclude;
export type UserWithIdentity = Prisma.UserGetPayload<{ include: typeof userInclude }>;

// Public-safe user shape — NEVER includes passwordHash or the WhatsApp verifyCode.
export function serializeUser(u: User, identity?: WhatsAppIdentity | null) {
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
    // Phase 13B — WhatsApp channel status. linked=false for legacy/seed users with
    // no identity. verifyCode/verifyExpires are NEVER exposed here (the code is
    // returned only in the register/resend/change responses to the owner).
    whatsapp: {
      linked:     !!identity,
      verified:   identity?.verified ?? false,
      phoneE164:  identity ? maskPhone(identity.phoneE164) : null,
      verifiedAt: identity?.verifiedAt ? identity.verifiedAt.toISOString() : null,
      // Phase 13G — WhatsApp-specific notification opt-out (read-only in Settings).
      optOut:     identity?.optOut ?? false,
    },
    createdAt: u.createdAt.toISOString(),
  };
}

export type PublicUser = ReturnType<typeof serializeUser>;

type Result<T> = { ok: true; user: T } | { ok: false; code: 'email_taken' | 'phone_taken' | 'invalid_credentials' };

// Result of issuing/refreshing a verification code. The plaintext code travels back
// to the OWNER only (register/resend/change responses), never via /me.
type CodeResult =
  | { ok: true; identity: WhatsAppIdentity; code: string }
  | { ok: false; code: 'phone_taken' | 'no_identity' | 'already_verified' };

export const authService = {
  // Phase 13B — register also creates the unverified WhatsAppIdentity (transactional
  // so we never orphan a user-without-identity). Phone is validated to E.164 upstream.
  async register(data: RegisterInput): Promise<Result<UserWithIdentity>> {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return { ok: false, code: 'email_taken' };

    // Pre-check phone uniqueness for a clean error; the @unique constraint is the
    // authoritative guard against a race (caught below).
    const phoneTaken = await prisma.whatsAppIdentity.findUnique({ where: { phoneE164: data.whatsappPhone } });
    if (phoneTaken) return { ok: false, code: 'phone_taken' };

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const verifyCode = generateCode();

    try {
      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          whatsappIdentity: {
            create: {
              phoneE164:     data.whatsappPhone,
              verified:      false,
              verifyCode,
              verifyExpires: codeExpiry(),
            },
          },
        },
        include: userInclude,
      });
      return { ok: true, user };
    } catch (err) {
      // Unique violation on email or phone under a race → typed error, no partial row.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = (err.meta?.target as string[] | undefined)?.join(',') ?? '';
        return { ok: false, code: target.includes('phone') ? 'phone_taken' : 'email_taken' };
      }
      throw err;
    }
  },

  async login(data: LoginInput): Promise<Result<UserWithIdentity>> {
    const user = await prisma.user.findUnique({ where: { email: data.email }, include: userInclude });
    // Constant-ish behavior: if the user exists but has no password (legacy/seed),
    // or the password is wrong, return the same generic error — no account enumeration.
    if (!user || !user.passwordHash) return { ok: false, code: 'invalid_credentials' };
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return { ok: false, code: 'invalid_credentials' };

    // Touch lastActiveAt on successful login (best-effort, non-blocking semantics).
    await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    return { ok: true, user };
  },

  async getById(id: string): Promise<UserWithIdentity | null> {
    return prisma.user.findUnique({ where: { id }, include: userInclude });
  },

  // ── Password recovery ────────────────────────────────────────────────────────
  // Issue a one-time reset token. Enumeration-safe: for an unknown email (or a legacy
  // user without a password) it succeeds with `sent:false`, so the route can return the
  // SAME generic response either way. Any previously-issued unused tokens for the user
  // are invalidated (deleted) so only the newest link works. Stores only the hash.
  async createPasswordReset(email: string): Promise<ForgotResult> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return { ok: true, sent: false };

    const { token, tokenHash } = generateResetToken();
    // Invalidate prior unused tokens for this user, then create the fresh one — atomic
    // so a request can never observe two live tokens.
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: resetExpiry() },
      }),
    ]);
    return { ok: true, sent: true, user, token };
  },

  // Consume a reset token and set the new password. Rejects invalid / expired / already-
  // used tokens with the same generic code. On success: hashes the new password, marks
  // the token used, and deletes all other tokens for that user — one transaction.
  async resetPassword(rawToken: string, newPassword: string): Promise<ResetResult> {
    const tokenHash = hashToken(rawToken);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      return { ok: false, code: 'invalid_or_expired' };
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Burn every other outstanding token for this user (the reset already happened).
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } }),
    ]);
    return { ok: true };
  },

  // Phase 13B — regenerate the verification code + 60-min expiry and reset the
  // wrong-attempt counter. No-op-safe: returns 'no_identity' for legacy users.
  async resendWhatsappCode(userId: string): Promise<CodeResult> {
    const identity = await prisma.whatsAppIdentity.findUnique({ where: { userId } });
    if (!identity) return { ok: false, code: 'no_identity' };
    // Already verified → no-op: do not mint a new code, touch expiry, or reset attempts.
    if (identity.verified) return { ok: false, code: 'already_verified' };

    const code = generateCode();
    const updated = await prisma.whatsAppIdentity.update({
      where: { userId },
      data:  { verifyCode: code, verifyExpires: codeExpiry(), attemptCount: 0 },
    });
    return { ok: true, identity: updated, code };
  },

  // Phase 13B — change the WhatsApp number. Re-points the identity, resets it to
  // unverified, issues a fresh code. Rejects a number already linked elsewhere.
  async changeWhatsappNumber(userId: string, phoneE164: string): Promise<CodeResult> {
    const identity = await prisma.whatsAppIdentity.findUnique({ where: { userId } });
    if (!identity) return { ok: false, code: 'no_identity' };

    // No-op short-circuit not required, but a taken number must be rejected.
    const taken = await prisma.whatsAppIdentity.findUnique({ where: { phoneE164 } });
    if (taken && taken.userId !== userId) return { ok: false, code: 'phone_taken' };

    const code = generateCode();
    try {
      const updated = await prisma.whatsAppIdentity.update({
        where: { userId },
        data:  {
          phoneE164,
          verified:      false,
          verifiedAt:    null,
          verifyCode:    code,
          verifyExpires: codeExpiry(),
          attemptCount:  0,
        },
      });
      return { ok: true, identity: updated, code };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { ok: false, code: 'phone_taken' };
      }
      throw err;
    }
  },
};
