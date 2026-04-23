/// <reference lib="deno.ns" />
/**
 * Fee math for tip pricing. Mirror of `packages/supabase-client/src/fees.ts`
 * in the frontend bundle — keep the constants + function shapes identical.
 * The two exist because Deno URL imports and browser ESM can't share a
 * module.
 *
 * Constants are US-domestic-card values. International cards and AMEX
 * undercollect by a few cents; the tip page UI documents that caveat.
 */
export const STRIPE_PERCENT = 0.029;
export const STRIPE_FIXED_CENTS = 30;
export const PLATFORM_FEE_CENTS = 1;

export interface CoveredFeesResult {
  amountTotalCents: number;
  stripeFeeCents: number;
  platformFeeCents: number;
}

export interface SharedFeesResult {
  amountNetCents: number;
  stripeFeeCents: number;
  platformFeeCents: number;
}

/**
 * Solve for the total the viewer pays so the streamer nets at least
 * `netCents` after Stripe + platform fees. We bump by 1 cent per iteration
 * to handle the `ceil` in the Stripe fee formula — up to 10 bumps is
 * always enough.
 */
export function computeCoveredFees(netCents: number): CoveredFeesResult {
  if (!Number.isFinite(netCents) || netCents <= 0 || !Number.isInteger(netCents)) {
    throw new Error(`computeCoveredFees: netCents must be a positive integer, got ${netCents}`);
  }
  let total = Math.ceil(
    (netCents + STRIPE_FIXED_CENTS + PLATFORM_FEE_CENTS) / (1 - STRIPE_PERCENT),
  );
  for (let i = 0; i < 10; i++) {
    const stripeFee = Math.ceil(total * STRIPE_PERCENT) + STRIPE_FIXED_CENTS;
    const net = total - stripeFee - PLATFORM_FEE_CENTS;
    if (net >= netCents) {
      return {
        amountTotalCents: total,
        stripeFeeCents: stripeFee,
        platformFeeCents: PLATFORM_FEE_CENTS,
      };
    }
    total += 1;
  }
  throw new Error("computeCoveredFees: did not converge");
}

/**
 * If the viewer doesn't cover fees, the streamer's net is whatever's left
 * after Stripe + platform take their cut.
 */
export function computeSharedFees(totalCents: number): SharedFeesResult {
  if (!Number.isFinite(totalCents) || totalCents < 0 || !Number.isInteger(totalCents)) {
    throw new Error(`computeSharedFees: totalCents must be a non-negative integer, got ${totalCents}`);
  }
  const stripeFee = Math.ceil(totalCents * STRIPE_PERCENT) + STRIPE_FIXED_CENTS;
  const net = Math.max(0, totalCents - stripeFee - PLATFORM_FEE_CENTS);
  return {
    amountNetCents: net,
    stripeFeeCents: stripeFee,
    platformFeeCents: PLATFORM_FEE_CENTS,
  };
}
