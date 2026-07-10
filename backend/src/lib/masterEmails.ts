import type { SystemRole } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Master-user allowlist, driven entirely by the MASTER_EMAILS env var — never
// hardcoded in application code or set manually in the database. Comma-
// separated, case-insensitive. Works identically across dev/staging/production:
// changing the env var (and re-authenticating) is the only way to grant or
// revoke MASTER access.
//
//   MASTER_EMAILS=ori.chaimatan@gmail.com,sharoncm@gmail.com
// ─────────────────────────────────────────────────────────────────────────────

function masterEmailSet(): Set<string> {
  return new Set(
    (process.env.MASTER_EMAILS ?? '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

// Derives the systemRole an email SHOULD have right now, based on the current
// MASTER_EMAILS value. Callers persist this if it differs from the stored value
// (see authService.syncSystemRole) so DB state self-heals on every login/lookup
// without any manual migration when the env var changes.
export function resolveSystemRole(email: string): SystemRole {
  return masterEmailSet().has(email.trim().toLowerCase()) ? 'MASTER' : 'USER';
}
