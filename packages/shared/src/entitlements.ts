import type { PlanFeatures, PlanLimits, FeatureKey, LimitKey, PlanCode } from './plans';
import { ENTITLED_SUBSCRIPTION_STATUSES, type SubscriptionStatus } from './enums';

/**
 * What a workspace may do right now: its plan merged with any per-workspace
 * overrides an admin has set. The API computes this on every gated request;
 * the dashboard receives the same object to grey out what the plan lacks.
 */
export interface Entitlements {
  planCode: PlanCode | null;
  planName: string | null;
  status: SubscriptionStatus | null;
  /** True when the subscription unlocks the product at all. */
  active: boolean;
  /**
   * On the Free plan: either chosen, or because the workspace has no live paid
   * subscription (never subscribed, or a paid plan ended).
   */
  free: boolean;
  includedMinutes: number | null;
  limits: PlanLimits;
  features: PlanFeatures;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface UsageSnapshot {
  minutesUsed: number;
  minutesIncluded: number | null;
  agents: number;
  phoneNumbers: number;
  campaigns: number;
  integrations: number;
  webhooks: number;
  apiKeys: number;
  automations: number;
}

export function isEntitledStatus(status: SubscriptionStatus | null | undefined): boolean {
  return !!status && ENTITLED_SUBSCRIPTION_STATUSES.includes(status);
}

export function mergeLimits(base: PlanLimits, overrides?: Partial<PlanLimits> | null): PlanLimits {
  if (!overrides) return { ...base };
  const out = { ...base };
  for (const key of Object.keys(overrides) as LimitKey[]) {
    const v = overrides[key];
    if (v === undefined) continue;
    (out as Record<LimitKey, number | null>)[key] = v;
  }
  return out;
}

export function mergeFeatures(
  base: PlanFeatures,
  overrides?: Partial<PlanFeatures> | null,
): PlanFeatures {
  return { ...base, ...(overrides ?? {}) };
}

/** `null` limits are unlimited. A limit of 0 means the feature is off. */
export function withinLimit(limit: number | null, currentCount: number, adding = 1): boolean {
  if (limit === null) return true;
  return currentCount + adding <= limit;
}

export function hasFeature(
  ent: Pick<Entitlements, 'active' | 'features'>,
  key: FeatureKey,
): boolean {
  return ent.active && ent.features[key];
}

export function minutesRemaining(ent: Entitlements, usedMinutes: number): number | null {
  if (ent.includedMinutes === null) return null;
  return Math.max(0, ent.includedMinutes - usedMinutes);
}

/** Calls are billed per started minute, the way carriers bill. */
export function billableMinutes(durationSec: number): number {
  if (durationSec <= 0) return 0;
  return Math.ceil(durationSec / 60);
}
