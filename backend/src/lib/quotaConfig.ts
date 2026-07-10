// ─────────────────────────────────────────────────────────────────────────────
// Master switch for roles/plans/usage enforcement. Mirrors the SOURCE_ANALYSIS_
// ENABLED / CONTENT_GENERATION_ENABLED pattern elsewhere: MUST default false so
// the enforcement code (usageService + its call sites) can ship and be verified
// against real traffic before any user is actually blocked by it.
// ─────────────────────────────────────────────────────────────────────────────

export const quotaConfig = {
  enforceQuotas: process.env.ENFORCE_QUOTAS === 'true',
} as const;
