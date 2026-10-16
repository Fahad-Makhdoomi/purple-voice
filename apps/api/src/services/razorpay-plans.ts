import type { Plan } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { HttpError } from '../lib/http-error';
import { createRazorpayPlan } from './razorpay';

/**
 * Razorpay charges in rupees, while plans are priced in US dollars. So staff
 * don't have to create Razorpay plans by hand, Purple Voice creates them
 * itself: the plan's INR price (Admin → Plans & pricing) if one is set, else
 * the USD price at today's exchange rate, rounded to ₹10. A new Razorpay plan
 * is only created when that amount changes; existing subscribers stay on the
 * plan they signed up for. A plan id pasted by staff is used as it is.
 */

const RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const RATE_TTL_MS = 12 * 60 * 60 * 1000;
/** Used only if the rate service can't be reached and nothing is cached. */
const FALLBACK_USD_INR = 88;

let cached: { rate: number; at: number } | null = null;

export async function usdToInrRate(): Promise<number> {
  if (cached && Date.now() - cached.at < RATE_TTL_MS) return cached.rate;
  try {
    const res = await fetch(RATE_URL, { signal: AbortSignal.timeout(8000) });
    const json = (await res.json()) as { result?: string; rates?: { INR?: number } };
    const rate = json.rates?.INR;
    if (!res.ok || json.result !== 'success' || !rate || rate < 30 || rate > 300)
      throw new Error('bad rate response');
    cached = { rate, at: Date.now() };
    return rate;
  } catch (err) {
    logger.warn({ err }, 'USD→INR rate unavailable; using the last known or fallback rate');
    return cached?.rate ?? FALLBACK_USD_INR;
  }
}

/** Monthly INR price in paise, rounded to ₹10; null for custom-priced plans. */
export function inrPaiseFor(
  plan: Pick<Plan, 'priceMonthlyCents' | 'priceMonthlyInrPaise'>,
  rate: number,
): number | null {
  if (plan.priceMonthlyInrPaise) return plan.priceMonthlyInrPaise;
  if (!plan.priceMonthlyCents) return null;
  const rupees = (plan.priceMonthlyCents / 100) * rate;
  return Math.max(10, Math.round(rupees / 10) * 10) * 100;
}

/** INR prices to show next to the dollar prices on the billing page. */
export async function inrPrices(plans: Plan[]): Promise<Record<string, number | null>> {
  const rate = await usdToInrRate();
  return Object.fromEntries(
    plans.map((p) => [
      p.code,
      p.razorpayPlanId && p.razorpayPlanAmountPaise === null ? null : inrPaiseFor(p, rate),
    ]),
  );
}

/** Whether a plan can be bought through Razorpay. */
export function razorpayCanSell(
  plan: Pick<Plan, 'razorpayPlanId' | 'priceMonthlyCents' | 'priceMonthlyInrPaise'>,
): boolean {
  return !!plan.razorpayPlanId || !!plan.priceMonthlyInrPaise || !!plan.priceMonthlyCents;
}

/** The Razorpay plan id to subscribe to, creating the INR plan when needed. */
export async function ensureRazorpayPlan(plan: Plan): Promise<string> {
  // Pasted by staff: theirs to manage.
  if (plan.razorpayPlanId && plan.razorpayPlanAmountPaise === null) return plan.razorpayPlanId;

  const amount = inrPaiseFor(plan, await usdToInrRate());
  if (!amount) throw new HttpError(400, `The ${plan.name} plan has no price to charge`);
  if (plan.razorpayPlanId && plan.razorpayPlanAmountPaise === amount) return plan.razorpayPlanId;

  const created = await createRazorpayPlan({
    name: `Purple Voice ${plan.name}`,
    amountPaise: amount,
    description: `${plan.name} plan, billed monthly`,
  });
  await prisma.plan.update({
    where: { id: plan.id },
    data: { razorpayPlanId: created.id, razorpayPlanAmountPaise: amount },
  });
  logger.info({ plan: plan.code, amount, razorpayPlan: created.id }, 'Created Razorpay INR plan');
  return created.id;
}
