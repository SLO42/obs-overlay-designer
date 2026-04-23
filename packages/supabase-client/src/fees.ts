/**
 * Fee math shared between the builder UI (for preview) and the Edge
 * Functions (for authoritative computation). Keep this file byte-identical
 * to `supabase/functions/_shared/fees.ts` — if you change one, change the
 * other. The split exists because the Edge runtime is Deno (URL imports)
 * and the builder is browser ESM; they can't share a module directly.
 *
 * Constants are US-domestic-card values as of 2025. International cards and
 * AMEX undercollect by a few cents; we document that in the tip page UI.
 */
export const STRIPE_PERCENT = 0.029;
export const STRIPE_FIXED_CENTS = 30;
export const PLATFORM_FEE_CENTS = 1;

export interface CoveredFeesResult {
  /** Total minor units the viewer is charged. */
  amountTotalCents: number;
  /** Stripe processing fee (ceil(total*0.029) + 30). */
  stripeFeeCents: number;
  /** Platform application_fee_amount — always PLATFORM_FEE_CENTS today. */
  platformFeeCents: number;
}

export interface SharedFeesResult {
  /** Streamer's net after Stripe + platform fees come out of the total. */
  amountNetCents: number;
  stripeFeeCents: number;
  platformFeeCents: number;
}

/**
 * Given a desired streamer-net amount in cents, solve for the viewer's
 * total charge such that:
 *   total - ceil(total*0.029) - 30 - PLATFORM_FEE_CENTS >= netCents
 *
 * We start from the closed-form approximation then bump the total by 1
 * cent at a time until the inequality holds. The `ceil` in the Stripe
 * fee formula means the closed-form can undercount by a single cent; a
 * tiny bounded loop is simpler than solving the ceiling exactly.
 *
 * Throws if it doesn't converge inside 10 iterations — that would signal
 * the constants changed in a way the approximation can't handle.
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
 * When the viewer opts out of covering fees, Stripe + platform take their
 * cut from the total. Returns the streamer's actual net.
 *
 * Returns `amountNetCents: 0` rather than a negative number if the total
 * is smaller than the fixed fees — the Edge Function still rejects such
 * donations on the amount-floor check, but this keeps the math defensive.
 */
export function computeSharedFees(totalCents: number): SharedFeesResult {
  if (!Number.isFinite(totalCents) || totalCents < 0 || !Number.isInteger(totalCents)) {
    throw new Error(
      `computeSharedFees: totalCents must be a non-negative integer, got ${totalCents}`,
    );
  }
  const stripeFee = Math.ceil(totalCents * STRIPE_PERCENT) + STRIPE_FIXED_CENTS;
  const net = Math.max(0, totalCents - stripeFee - PLATFORM_FEE_CENTS);
  return {
    amountNetCents: net,
    stripeFeeCents: stripeFee,
    platformFeeCents: PLATFORM_FEE_CENTS,
  };
}
