import type {
  ChatFragment,
  ChatMessage,
  CheerEvent,
  FollowEvent,
  RaidEvent,
  RedeemEvent,
  StreamEvent,
  SubEvent,
} from "@obs/core";
import { buildEmoteUrl } from "../emotes/firstParty";
import type { NotificationMessage } from "./messages";

/**
 * Structural types for the event payload of each subscription we care
 * about. These mirror Twitch's published schema but we only require the
 * fields we read — extra fields are allowed and ignored, so a Twitch-side
 * addition won't break normalization.
 */

interface TwitchFragmentEmote {
  id: string;
  emote_set_id?: string;
  owner_id?: string;
  format?: string[];
}
interface TwitchFragmentCheermote {
  prefix: string;
  bits: number;
  tier: number;
}
interface TwitchFragmentMention {
  user_id: string;
  user_login: string;
  user_name: string;
}
interface TwitchFragment {
  type: "text" | "emote" | "cheermote" | "mention";
  text: string;
  emote?: TwitchFragmentEmote | null;
  cheermote?: TwitchFragmentCheermote | null;
  mention?: TwitchFragmentMention | null;
}
interface TwitchBadge {
  set_id: string;
  id: string;
  info?: string;
}

interface ChatMessagePayload {
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  chatter_user_id: string;
  chatter_user_login: string;
  chatter_user_name: string;
  message_id: string;
  message: { text: string; fragments: TwitchFragment[] };
  color?: string;
  badges: TwitchBadge[];
  message_type?: string;
  cheer?: { bits: number } | null;
}

interface CheerPayload {
  is_anonymous: boolean;
  user_id: string | null;
  user_login: string | null;
  user_name: string | null;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  message: string;
  bits: number;
}

interface SubscribePayload {
  user_id: string;
  user_login: string;
  user_name: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  tier: string;
  is_gift: boolean;
}

interface SubGiftPayload {
  user_id: string | null;
  user_login: string | null;
  user_name: string | null;
  broadcaster_user_id: string;
  tier: string;
  total: number;
  cumulative_total?: number | null;
  is_anonymous: boolean;
}

interface FollowPayload {
  user_id: string;
  user_login: string;
  user_name: string;
  broadcaster_user_id: string;
  followed_at: string;
}

interface RaidPayload {
  from_broadcaster_user_id: string;
  from_broadcaster_user_login: string;
  from_broadcaster_user_name: string;
  to_broadcaster_user_id: string;
  viewers: number;
}

interface RedemptionPayload {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  user_input?: string;
  status?: string;
  reward: { id: string; title: string; cost?: number; prompt?: string };
}

/**
 * Map Twitch's badges array into the `roles` array our ChatMessage uses.
 * Twitch carries many badges (bits tiers, predictions, founder, etc.); we
 * only lift the four that affect rendering precedence: broadcaster, mod,
 * vip, subscriber. "viewer" is synthesized when no role-bearing badge is
 * present so downstream widgets always have at least one role.
 */
function rolesFromBadges(badges: TwitchBadge[]): ChatMessage["user"]["roles"] {
  const roles: ChatMessage["user"]["roles"] = [];
  for (const badge of badges) {
    switch (badge.set_id) {
      case "broadcaster":
        roles.push("broadcaster");
        break;
      case "moderator":
        roles.push("mod");
        break;
      case "vip":
        roles.push("vip");
        break;
      case "subscriber":
      case "founder":
        roles.push("subscriber");
        break;
      default:
        break;
    }
  }
  if (roles.length === 0) roles.push("viewer");
  return roles;
}

/**
 * Flatten Twitch's fragment array into `@obs/core`'s ChatFragment union.
 * Emote fragments get a 2x static URL by default; widgets that want a
 * different scale can rebuild the URL from `emoteId`.
 */
function mapFragments(fragments: TwitchFragment[]): ChatFragment[] {
  const out: ChatFragment[] = [];
  for (const frag of fragments) {
    switch (frag.type) {
      case "text":
        out.push({ type: "text", text: frag.text });
        break;
      case "emote": {
        const id = frag.emote?.id;
        out.push({
          type: "emote",
          text: frag.text,
          emoteId: id,
          emoteUrl: id ? buildEmoteUrl(id) : undefined,
        });
        break;
      }
      case "cheermote":
        out.push({
          type: "cheermote",
          text: frag.text,
          bits: frag.cheermote?.bits,
        });
        break;
      case "mention":
        out.push({ type: "mention", text: frag.text });
        break;
      default:
        // Future-compat: pass unknown types through as text so the message
        // body isn't lost even when Twitch introduces a new fragment kind.
        out.push({ type: "text", text: frag.text });
    }
  }
  return out;
}

/**
 * Normalize an EventSub notification into a `StreamEvent`. Returns null
 * for subscription types we don't handle (intended — we may add new subs
 * and want the parser to quietly no-op rather than throw).
 *
 * `receivedAt` uses the local clock rather than `metadata.message_timestamp`
 * — overlays care about wall-clock delivery time, not Twitch's server
 * timestamp, and keeping both monotonic requires a single clock source.
 */
export function normalizeNotification(message: NotificationMessage): StreamEvent | null {
  const type = message.payload.subscription.type;
  const event = message.payload.event as unknown;
  const now = Date.now();

  switch (type) {
    case "channel.chat.message": {
      const e = event as ChatMessagePayload;
      const fragments = mapFragments(e.message?.fragments ?? []);
      const plain = fragments.map((f) => f.text).join("");
      const result: ChatMessage = {
        kind: "chat.message",
        id: e.message_id,
        user: {
          id: e.chatter_user_id,
          login: e.chatter_user_login,
          displayName: e.chatter_user_name,
          color: e.color && e.color.length > 0 ? e.color : undefined,
          roles: rolesFromBadges(e.badges ?? []),
        },
        fragments,
        plain,
        receivedAt: now,
      };
      return result;
    }

    case "channel.cheer": {
      const e = event as CheerPayload;
      const user =
        e.is_anonymous || !e.user_id
          ? null
          : {
              id: e.user_id!,
              login: e.user_login ?? "",
              displayName: e.user_name ?? "",
            };
      const result: CheerEvent = {
        kind: "channel.cheer",
        id: `${message.metadata.message_id}`,
        user,
        bits: e.bits,
        message: e.message,
        receivedAt: now,
      };
      return result;
    }

    case "channel.subscribe": {
      const e = event as SubscribePayload;
      const result: SubEvent = {
        kind: "channel.subscribe",
        id: `${message.metadata.message_id}`,
        user: {
          id: e.user_id,
          login: e.user_login,
          displayName: e.user_name,
        },
        tier: (e.tier as "1000" | "2000" | "3000") ?? "1000",
        isGift: e.is_gift,
        receivedAt: now,
      };
      return result;
    }

    case "channel.subscription.gift": {
      const e = event as SubGiftPayload;
      const user =
        e.is_anonymous || !e.user_id
          ? { id: "anonymous", login: "anonymous", displayName: "Anonymous" }
          : {
              id: e.user_id,
              login: e.user_login ?? "",
              displayName: e.user_name ?? "",
            };
      const result: SubEvent = {
        kind: "channel.subscription.gift",
        id: `${message.metadata.message_id}`,
        user,
        tier: (e.tier as "1000" | "2000" | "3000") ?? "1000",
        isGift: true,
        cumulativeMonths: e.cumulative_total ?? undefined,
        receivedAt: now,
      };
      return result;
    }

    case "channel.follow": {
      const e = event as FollowPayload;
      const result: FollowEvent = {
        kind: "channel.follow",
        id: `${message.metadata.message_id}`,
        user: {
          id: e.user_id,
          login: e.user_login,
          displayName: e.user_name,
        },
        receivedAt: now,
      };
      return result;
    }

    case "channel.raid": {
      const e = event as RaidPayload;
      const result: RaidEvent = {
        kind: "channel.raid",
        id: `${message.metadata.message_id}`,
        from: {
          id: e.from_broadcaster_user_id,
          login: e.from_broadcaster_user_login,
          displayName: e.from_broadcaster_user_name,
        },
        viewers: e.viewers,
        receivedAt: now,
      };
      return result;
    }

    case "channel.channel_points_custom_reward_redemption.add": {
      const e = event as RedemptionPayload;
      const result: RedeemEvent = {
        kind: "channel.channel_points_custom_reward_redemption.add",
        id: e.id,
        user: {
          id: e.user_id,
          login: e.user_login,
          displayName: e.user_name,
        },
        rewardId: e.reward.id,
        rewardTitle: e.reward.title,
        userInput: e.user_input && e.user_input.length > 0 ? e.user_input : undefined,
        receivedAt: now,
      };
      return result;
    }

    default:
      return null;
  }
}
