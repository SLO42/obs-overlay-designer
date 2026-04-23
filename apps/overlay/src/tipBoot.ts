import type { DonationEvent, EventBus, StreamEvent } from "@obs/core";
import {
  createSupabaseClient,
  subscribeTipsChannel,
  type SupabaseClient,
  type TipBroadcastPayload,
} from "@obs/supabase-client";
import type { OverlayConfig } from "./boot";

/**
 * Returns the three pieces needed to bring up the tip subscription or
 * `null` if the embedded config is missing any of them. Exported so the
 * App useEffect and the test both share the same shape.
 */
export function supabaseAutoConnectFrom(config: OverlayConfig | null): {
  url: string;
  anonKey: string;
  slug: string;
} | null {
  const sb = config?.supabase;
  const slug = config?.project?.streamteam?.slug;
  if (!sb?.url || !sb.anonKey) return null;
  if (!slug) return null;
  return { url: sb.url, anonKey: sb.anonKey, slug };
}

/**
 * Convert a `TipBroadcastPayload` into a `DonationEvent` ready for
 * `overlayBus.emit`. Pure so we can unit test it without any React /
 * subscribe plumbing.
 */
export function tipBroadcastToDonation(tip: TipBroadcastPayload): DonationEvent {
  return {
    kind: "donation",
    id: tip.id,
    source: "streamteam-tip",
    user: tip.user
      ? {
          displayName: tip.user.displayName,
          ...(tip.user.login ? { login: tip.user.login } : {}),
        }
      : null,
    amount: tip.amount,
    currency: tip.currency,
    ...(tip.message !== undefined ? { message: tip.message } : {}),
    ...(tip.feeAmount !== undefined ? { feeAmount: tip.feeAmount } : {}),
    ...(tip.coveredFees !== undefined ? { coveredFees: tip.coveredFees } : {}),
    receivedAt: tip.receivedAt,
  };
}

/**
 * Spin up the supabase client + channel subscription and return a cleanup.
 * `deps` is injectable so tests can swap in fakes.
 */
export interface StartTipSubscriptionDeps {
  createClient?: (url: string, anonKey: string) => SupabaseClient;
  subscribe?: (
    client: SupabaseClient,
    slug: string,
    listener: (tip: TipBroadcastPayload) => void,
  ) => () => void;
}

export function startTipSubscription(
  config: OverlayConfig | null,
  bus: EventBus<StreamEvent>,
  deps: StartTipSubscriptionDeps = {},
): (() => void) | null {
  const auto = supabaseAutoConnectFrom(config);
  if (!auto) return null;
  const createClient = deps.createClient ?? createSupabaseClient;
  const subscribe = deps.subscribe ?? subscribeTipsChannel;
  const client = createClient(auto.url, auto.anonKey);
  const cleanup = subscribe(client, auto.slug, (tip) => {
    bus.emit(tipBroadcastToDonation(tip));
  });
  return cleanup;
}
