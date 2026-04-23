import { describe, expect, it } from "vitest";
import {
  computeCoveredFees,
  computeSharedFees,
  PLATFORM_FEE_CENTS,
  STRIPE_FIXED_CENTS,
  STRIPE_PERCENT,
} from "./fees";

/**
 * Sanity: the constants documented in the task spec are what this module
 * actually exports. Locks the contract with the Edge Function twin.
 */
describe("fee constants", () => {
  it("match the platform decisions", () => {
    expect(STRIPE_PERCENT).toBe(0.029);
    expect(STRIPE_FIXED_CENTS).toBe(30);
    expect(PLATFORM_FEE_CENTS).toBe(1);
  });
});

describe("computeCoveredFees", () => {
  it("a $3.00 net tip produces a total where streamer nets at least 300 cents", () => {
    const { amountTotalCents, stripeFeeCents, platformFeeCents } = computeCoveredFees(300);
    // Streamer net after fees must be >= the requested 300.
    expect(amountTotalCents - stripeFeeCents - platformFeeCents).toBeGreaterThanOrEqual(300);
    // Total must exceed the hard minimum net + fixed fees.
    expect(amountTotalCents).toBeGreaterThanOrEqual(300 + 30 + 1);
    expect(platformFeeCents).toBe(1);
  });

  it("a $1.00 net tip (minimum) still computes a sensible total", () => {
    const { amountTotalCents, stripeFeeCents } = computeCoveredFees(100);
    expect(amountTotalCents - stripeFeeCents - 1).toBeGreaterThanOrEqual(100);
    // ~100 + 30 + ceil(0.029 * ~134) + 1 → around 135.
    expect(amountTotalCents).toBeGreaterThan(130);
    expect(amountTotalCents).toBeLessThan(140);
  });

  it("a large tip ($100 net) converges", () => {
    const { amountTotalCents, stripeFeeCents } = computeCoveredFees(10000);
    expect(amountTotalCents - stripeFeeCents - 1).toBeGreaterThanOrEqual(10000);
    // ~10000 / (1 - 0.029) + 30 + 1 ≈ 10330. Give ±5 slack for ceil bumps.
    expect(amountTotalCents).toBeGreaterThan(10320);
    expect(amountTotalCents).toBeLessThan(10345);
  });

  it("the bump-loop lands on the smallest total that satisfies the net", () => {
    // For any valid (total, net) produced, total-1 must UNDERSHOOT the net.
    const { amountTotalCents } = computeCoveredFees(500);
    const underShootStripeFee = Math.ceil((amountTotalCents - 1) * 0.029) + 30;
    const underShootNet = amountTotalCents - 1 - underShootStripeFee - 1;
    expect(underShootNet).toBeLessThan(500);
  });

  it("rejects bad inputs", () => {
    expect(() => computeCoveredFees(0)).toThrow();
    expect(() => computeCoveredFees(-100)).toThrow();
    expect(() => computeCoveredFees(1.5)).toThrow();
    expect(() => computeCoveredFees(Number.NaN)).toThrow();
  });
});

describe("computeSharedFees", () => {
  it("a $3.00 total produces a net < 300", () => {
    const { amountNetCents, stripeFeeCents, platformFeeCents } = computeSharedFees(300);
    expect(amountNetCents).toBeLessThan(300);
    expect(stripeFeeCents).toBe(Math.ceil(300 * 0.029) + 30);
    expect(platformFeeCents).toBe(1);
    expect(amountNetCents + stripeFeeCents + platformFeeCents).toBe(300);
  });

  it("clamps net to 0 when fixed fees would eat the whole payment", () => {
    // 20 cents total: Stripe fee floor alone is 30, fees exceed total.
    const { amountNetCents } = computeSharedFees(20);
    expect(amountNetCents).toBe(0);
  });
});
