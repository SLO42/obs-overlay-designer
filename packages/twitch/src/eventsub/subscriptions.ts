import type { HelixClient } from "../helix";

/**
 * The subscription types this package knows how to create. Exported so
 * callers can type their `subscribe` arrays without re-declaring the union.
 */
export type EventSubType =
  | "channel.chat.message"
  | "channel.cheer"
  | "channel.subscribe"
  | "channel.subscription.gift"
  | "channel.follow"
  | "channel.raid"
  | "channel.channel_points_custom_reward_redemption.add";

export interface CreateSubscriptionOptions {
  sessionId: string;
  channelUserId: string;
  selfUserId: string;
}

interface SubscriptionRequest {
  type: string;
  version: string;
  condition: Record<string, string>;
  transport: { method: "websocket"; session_id: string };
}

/**
 * Describe the Helix payload for a given subscription type. Condition
 * fields differ per type (most just want `broadcaster_user_id`; chat also
 * requires `user_id`; follow v2 requires `moderator_user_id`). Version
 * also differs — follow is "2", the rest are "1".
 */
export function buildSubscriptionRequest(
  type: EventSubType,
  opts: CreateSubscriptionOptions,
): SubscriptionRequest {
  const base = {
    transport: { method: "websocket" as const, session_id: opts.sessionId },
  };
  switch (type) {
    case "channel.chat.message":
      return {
        type,
        version: "1",
        condition: {
          broadcaster_user_id: opts.channelUserId,
          user_id: opts.selfUserId,
        },
        ...base,
      };
    case "channel.follow":
      return {
        type,
        version: "2",
        condition: {
          broadcaster_user_id: opts.channelUserId,
          moderator_user_id: opts.selfUserId,
        },
        ...base,
      };
    case "channel.cheer":
    case "channel.subscribe":
    case "channel.subscription.gift":
    case "channel.raid":
    case "channel.channel_points_custom_reward_redemption.add":
      return {
        type,
        version: "1",
        condition:
          type === "channel.raid"
            ? { to_broadcaster_user_id: opts.channelUserId }
            : { broadcaster_user_id: opts.channelUserId },
        ...base,
      };
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      throw new Error(`Unsupported EventSub subscription type: ${String(type)}`);
    }
  }
}

/**
 * Create every requested subscription in parallel. We don't enforce
 * per-request ordering — Twitch serializes them server-side anyway, and a
 * failed subscription (e.g. missing scope) shouldn't block the others.
 * Errors surface to the caller as an aggregated rejection via
 * `Promise.allSettled`.
 */
export async function createSubscriptions(
  helix: HelixClient,
  types: EventSubType[],
  opts: CreateSubscriptionOptions,
): Promise<{
  created: EventSubType[];
  failed: Array<{ type: EventSubType; error: Error }>;
}> {
  const results = await Promise.allSettled(
    types.map(async (type) => {
      const req = buildSubscriptionRequest(type, opts);
      await helix.post("eventsub/subscriptions", req);
      return type;
    }),
  );
  const created: EventSubType[] = [];
  const failed: Array<{ type: EventSubType; error: Error }> = [];
  for (let i = 0; i < results.length; i++) {
    const outcome = results[i]!;
    const type = types[i]!;
    if (outcome.status === "fulfilled") created.push(type);
    else failed.push({ type, error: outcome.reason as Error });
  }
  return { created, failed };
}
