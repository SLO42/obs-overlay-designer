import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shape broadcast by the `stripe-webhook` Edge Function on the
 * `tips:${slug}` channel, event name `donation`. Matches the subset of
 * `DonationEvent` that the overlay's SpeakAlert/DonationTicker widgets
 * care about — the overlay adapter fills in `kind: "donation"` before
 * emitting on the bus.
 */
export interface TipBroadcastPayload {
  id: string;
  source: "streamteam-tip";
  user: { displayName: string; login: string | null } | null;
  /** Streamer net in minor units (usually cents). */
  amount: number;
  /** "USD" today; schema allows other currencies but UI only offers USD. */
  currency: string;
  message?: string;
  /** Minor units; total fees associated with the donation. */
  feeAmount?: number;
  coveredFees?: boolean;
  receivedAt: number;
}

/** Cleanup returned by subscribeTipsChannel. Safe to call multiple times. */
export type Unsubscribe = () => void;

/** Channel name for a given slug. Exported so tests can assert on it. */
export function tipsChannelName(slug: string): string {
  return `tips:${slug}`;
}

/**
 * Subscribes to the realtime broadcast channel `tips:${slug}` and invokes
 * `listener` for each `donation` event. Returns a cleanup that unsubscribes
 * and removes the channel from the client. Swallows listener exceptions so
 * a broken consumer can't kill the channel.
 *
 * The server-side broadcast is triggered by `stripe-webhook` after a
 * successful checkout.session.completed; the broadcast payload is validated
 * shape-wise here to stay resilient to future payload additions.
 */
export function subscribeTipsChannel(
  client: SupabaseClient,
  slug: string,
  listener: (tip: TipBroadcastPayload) => void,
): Unsubscribe {
  if (!slug) {
    throw new Error("subscribeTipsChannel: slug is required");
  }
  const channel = client.channel(tipsChannelName(slug));
  channel
    .on("broadcast", { event: "donation" }, (message: { payload?: unknown }) => {
      const payload = message?.payload;
      if (!isTipBroadcastPayload(payload)) {
        console.warn("[supabase-client] ignoring malformed tip broadcast", payload);
        return;
      }
      try {
        listener(payload);
      } catch (err) {
        console.error("[supabase-client] tip listener threw", err);
      }
    })
    .subscribe();

  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    try {
      client.removeChannel(channel);
    } catch (err) {
      console.warn("[supabase-client] failed to remove channel", err);
    }
  };
}

/**
 * Narrow a raw broadcast payload into `TipBroadcastPayload`. Required
 * fields: id (string), source === "streamteam-tip", amount (number),
 * currency (string), receivedAt (number). Everything else is optional but
 * shape-checked if present.
 */
export function isTipBroadcastPayload(value: unknown): value is TipBroadcastPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") return false;
  if (v.source !== "streamteam-tip") return false;
  if (typeof v.amount !== "number") return false;
  if (typeof v.currency !== "string") return false;
  if (typeof v.receivedAt !== "number") return false;
  if (v.message !== undefined && typeof v.message !== "string") return false;
  if (v.feeAmount !== undefined && typeof v.feeAmount !== "number") return false;
  if (v.coveredFees !== undefined && typeof v.coveredFees !== "boolean") return false;
  if (v.user !== null && v.user !== undefined) {
    const u = v.user as Record<string, unknown>;
    if (typeof u.displayName !== "string") return false;
    if (u.login !== null && typeof u.login !== "string") return false;
  }
  return true;
}
