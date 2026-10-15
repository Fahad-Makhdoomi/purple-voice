import type { NextFunction, Request, Response } from 'express';
import { FEATURE_LABELS, type Entitlements, type FeatureKey } from '@pv/shared';
import { getEntitlements } from '../services/entitlements';
import { planLimit, subscriptionRequired } from '../lib/http-error';
import { wsId } from './workspace';

export async function entitlementsFor(req: Request): Promise<Entitlements> {
  if (!req.entitlements) req.entitlements = await getEntitlements(wsId(req));
  return req.entitlements;
}

/**
 * Connecting numbers, creating agents and placing calls all require a paid,
 * current subscription. Reading existing data does not, so a lapsed customer
 * can still see their history and billing page.
 */
export async function requireActiveSubscription(req: Request, _res: Response, next: NextFunction) {
  const ent = await entitlementsFor(req);
  if (!ent.active) {
    throw subscriptionRequired('Choose a plan to unlock this. Your data is safe in the meantime.');
  }
  next();
}

export function requireFeature(key: FeatureKey) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const ent = await entitlementsFor(req);
    if (!ent.active) throw subscriptionRequired();
    if (!ent.features[key]) {
      throw planLimit(`${FEATURE_LABELS[key]} is part of the Pro plan. Upgrade to use it.`, {
        feature: key,
      });
    }
    next();
  };
}
