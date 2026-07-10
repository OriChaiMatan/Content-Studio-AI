import type { Plan, ScheduleFrequency, UsageMetric } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for plan capabilities. Every limit, cycle length, and
// enabled-feature check in the app must read from here — never hardcode a
// number or platform list at an enforcement call site. Changing a plan's
// limits means editing exactly this file.
//
// Grouped into `limits` (numeric caps) and `features` (on/off capabilities) so
// the two kinds of "what does this plan allow" questions stay visually and
// structurally separate.
//
// `limits.perMetric` is a Record<UsageMetric, number> rather than one named
// field per metric. Adding a new UsageMetric in the future means: (1) add the
// enum value in schema.prisma (one migration), (2) add its cap to each plan's
// perMetric map here — TypeScript refuses to compile until every plan defines
// it. No enforcement call site, service, or route needs to change shape; they
// all read the cap generically via getUsageLimit(plan, metric).
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanLimits {
  // Live cap on simultaneously-active Content Cases. Enforced by counting rows
  // directly (not a UsageCounter metric) since it isn't cycle-based — a case
  // stays "active" until deleted/completed, not until the next reset.
  maxActiveCases: number;
  // Length of the plan's rolling usage cycle, in days.
  cycleDays: number;
  // Per-cycle cap for every UsageMetric.
  perMetric: Record<UsageMetric, number>;
}

export interface PlanFeatures {
  enabledPlatforms: readonly string[];
  // Which ScheduleFrequency values this plan may set on a case. The sole
  // source of truth for scheduling restrictions — isSchedulingAllowed
  // (usageService.ts) just checks membership here, no plan ever gets a
  // frequency rule hardcoded at the call site.
  allowedScheduleFrequencies: readonly ScheduleFrequency[];
}

export interface PlanDefinition {
  limits: PlanLimits;
  features: PlanFeatures;
}

const ENABLED_PLATFORMS = ['linkedin', 'facebook', 'newsletter', 'podcast'] as const;

export const PLAN_DEFINITIONS: Record<Plan, PlanDefinition> = {
  FREE: {
    limits: {
      maxActiveCases: 1,
      cycleDays: 7,
      perMetric: {
        PIPELINE_RUN: 1,
        SOURCE_ADDED: 15,
        IMAGE_GENERATION: 1,
      },
    },
    features: {
      enabledPlatforms: ENABLED_PLATFORMS,
      allowedScheduleFrequencies: ['manual', 'weekly', 'monthly'],
    },
  },
  PRO: {
    limits: {
      maxActiveCases: 50,
      cycleDays: 30,
      perMetric: {
        PIPELINE_RUN: 100,
        SOURCE_ADDED: 30,
        IMAGE_GENERATION: 100,
      },
    },
    features: {
      enabledPlatforms: ENABLED_PLATFORMS,
      allowedScheduleFrequencies: ['manual', 'daily', 'weekly', 'monthly'],
    },
  },
} as const;

export function getPlanDefinition(plan: Plan): PlanDefinition {
  return PLAN_DEFINITIONS[plan];
}

export function getUsageLimit(plan: Plan, metric: UsageMetric): number {
  return PLAN_DEFINITIONS[plan].limits.perMetric[metric];
}
