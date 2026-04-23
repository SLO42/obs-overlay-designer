import { describe, expect, it, vi } from "vitest";
import type { DonationEvent, StreamEvent } from "@obs/core";
import type { TipBroadcastPayload } from "@obs/supabase-client";
import { overlayBus } from "../bus";
import { startTipSubscription, tipBroadcastToDonation } from "../tipBoot";
import type { OverlayConfig } from "../boot";

/**
 * Covers the Supabase → overlayBus path: `startTipSubscription` reads the
 * embedded config, hands the broadcast to `tipBroadcastToDonation`, and
 * emits on the bus. We inject fake deps so no real Supabase client is
 * constructed.
 */

function makeConfig(): OverlayConfig {
  return {
    project: {
      meta: { id: "p1", name: "t", createdAt: 0, updatedAt: 0, version: 1 },
      canvas: { width: 1920, height: 1080 },
      widgets: [],
      streamteam: { slug: "alice" },
    },
    supabase: { url: "https://x.supabase.co", anonKey: "anon" },
  };
}

const sampleTip: TipBroadcastPayload = {
  id: "donation-uuid-1",
  source: "streamteam-tip",
  user: { displayName: "Alice", login: null },
  amount: 300,
  currency: "USD",
  message: "GL HF",
  feeAmount: 41,
  coveredFees: true,
  receivedAt: 1_700_000_000_000,
};

describe("tipBroadcastToDonation", () => {
  it("maps a full payload into a DonationEvent", () => {
    const ev = tipBroadcastToDonation(sampleTip);
    expect(ev).toMatchObject({
      kind: "donation",
      id: "donation-uuid-1",
      source: "streamteam-tip",
      amount: 300,
      currency: "USD",
      message: "GL HF",
      feeAmount: 41,
      coveredFees: true,
      receivedAt: 1_700_000_000_000,
    });
    expect(ev.user?.displayName).toBe("Alice");
    // login was null in the tip, so it's omitted from the DonationEvent
    // (the event type allows login?: string only).
    expect("login" in (ev.user ?? {})).toBe(false);
  });

  it("passes through an anonymous (null) user", () => {
    const ev = tipBroadcastToDonation({ ...sampleTip, user: null });
    expect(ev.user).toBeNull();
  });

  it("keeps login when provided", () => {
    const ev = tipBroadcastToDonation({
      ...sampleTip,
      user: { displayName: "Alice", login: "alice" },
    });
    expect(ev.user?.login).toBe("alice");
  });
});

describe("startTipSubscription", () => {
  it("returns null when the config is missing supabase settings", () => {
    const result = startTipSubscription(null, overlayBus);
    expect(result).toBeNull();
  });

  it("returns null when the slug is absent", () => {
    const config = makeConfig();
    config.project.streamteam = {};
    const result = startTipSubscription(config, overlayBus);
    expect(result).toBeNull();
  });

  it("wires a broadcast through to overlayBus as a DonationEvent", () => {
    let captured: ((tip: TipBroadcastPayload) => void) | null = null;
    const fakeCleanup = vi.fn();
    const createClient = vi.fn(() => ({}) as never);
    const subscribe = vi.fn((_client, _slug, listener) => {
      captured = listener;
      return fakeCleanup;
    });

    const received: StreamEvent[] = [];
    const off = overlayBus.on((e) => received.push(e));
    try {
      const cleanup = startTipSubscription(makeConfig(), overlayBus, {
        createClient,
        subscribe,
      });
      expect(cleanup).toBeTypeOf("function");
      expect(createClient).toHaveBeenCalledWith("https://x.supabase.co", "anon");
      expect(subscribe).toHaveBeenCalledTimes(1);
      expect(subscribe.mock.calls[0]![1]).toBe("alice");

      // Fire a broadcast.
      captured!(sampleTip);
      const donation = received.find((e): e is DonationEvent => e.kind === "donation");
      expect(donation).toBeTruthy();
      expect(donation!.id).toBe("donation-uuid-1");
      expect(donation!.amount).toBe(300);
      expect(donation!.source).toBe("streamteam-tip");

      cleanup!();
      expect(fakeCleanup).toHaveBeenCalled();
    } finally {
      off();
    }
  });
});
