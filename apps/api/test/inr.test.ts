import { describe, expect, it } from 'vitest';
import { checkoutSchema } from '@pv/shared';
import { inrPaiseFor, razorpayCanSell } from '../src/services/razorpay-plans';

describe('Razorpay rupee pricing', () => {
  it('converts the dollar price at the rate, rounded to ₹10', () => {
    expect(inrPaiseFor({ priceMonthlyCents: 29900, priceMonthlyInrPaise: null }, 88.4)).toBe(
      2643000,
    );
    expect(inrPaiseFor({ priceMonthlyCents: 1900, priceMonthlyInrPaise: null }, 88.4)).toBe(168000);
  });

  it('uses a fixed rupee price when staff set one', () => {
    expect(inrPaiseFor({ priceMonthlyCents: 29900, priceMonthlyInrPaise: 2499900 }, 88)).toBe(
      2499900,
    );
  });

  it('cannot price custom (Enterprise) plans', () => {
    expect(inrPaiseFor({ priceMonthlyCents: null, priceMonthlyInrPaise: null }, 88)).toBeNull();
    expect(
      razorpayCanSell({
        razorpayPlanId: null,
        priceMonthlyCents: null,
        priceMonthlyInrPaise: null,
      }),
    ).toBe(false);
    expect(
      razorpayCanSell({
        razorpayPlanId: null,
        priceMonthlyCents: 1900,
        priceMonthlyInrPaise: null,
      }),
    ).toBe(true);
  });
});

describe('GST number at checkout', () => {
  const parse = (gstin: string) => checkoutSchema.safeParse({ planCode: 'PRO', gstin });
  it('accepts a valid GSTIN in any case, and empty', () => {
    expect(parse('29abcde1234f1z5').success).toBe(true);
    expect(parse('').success).toBe(true);
  });
  it('rejects malformed ones', () => {
    expect(parse('29ABCDE1234F1Y5').success).toBe(false);
    expect(parse('ABCDE1234F').success).toBe(false);
  });
});
