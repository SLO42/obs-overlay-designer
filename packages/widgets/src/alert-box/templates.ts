import type {
  ChatMessage,
  CheerEvent,
  DonationEvent,
  FollowEvent,
  RaidEvent,
  RedeemEvent,
  StreamEvent,
  SubEvent,
} from "@obs/core";
import type { AlertBoxProps, EventTemplate } from "./schema";

/**
 * Resolved placeholders for all known alert event types. Every field is
 * always a string — events that don't carry a given piece of data expose
 * empty strings rather than undefined so `{placeholder}` interpolation is
 * always safe and never leaks literal "undefined" into user-visible copy.
 */
export interface PlaceholderMap {
  /** Best-available human name. Falls back to login, then "Anonymous". */
  user: string;
  /** Login-slug (Twitch handle). "" when anonymous or not present. */
  login: string;
  /** Display name (fancy capitalization). Falls back to login. */
  displayName: string;
  /**
   * For donations: minor-unit formatted amount string ("5.00").
   * For cheers: bit count ("500").
   * Else "0" — events without a numeric amount still resolve safely.
   */
  amount: string;
  /** Donation currency ("USD"/"EUR"/...), "BITS" for cheers, "" otherwise. */
  currency: string;
  /** Raw bit count as a string. "" for non-cheer events. */
  bits: string;
  /** Raw sub tier ("1000"|"2000"|"3000") for sub events, "" otherwise. */
  tier: string;
  /** Human tier label ("1"/"2"/"3"), pass-through for unknown values. */
  tierLabel: string;
  /** Sub-gift count as a string. Always "1" until bulk-gifts surface a real total. */
  count: string;
  /** Empty for count === 1, "s" otherwise — used in "{count} sub{countPlural}". */
  countPlural: string;
  /** Free-form message text (cheer message, donation memo, chat text). */
  message: string;
  /** Raid viewer count as a string, "" otherwise. */
  viewers: string;
  /** Raid source display name. "" otherwise. */
  from: string;
  /** Reward title for redemptions. "" otherwise. */
  rewardTitle: string;
  /** User-supplied text for redemptions. "" otherwise. */
  userInput: string;
}

/** One of the six template keys on `alertBoxSchema`. */
export type AlertKind = "follow" | "subscribe" | "subGift" | "cheer" | "raid" | "donation";

export interface ResolvedAlert {
  kind: AlertKind;
  title: string;
  subtitle: string;
  accent: string;
  mediaImage: string;
  mediaAudio: string;
  mediaVolume: number;
  receivedAt: number;
  /**
   * Kept for tests/debug. The Runtime never reads this field — it renders
   * purely from title/subtitle/accent/media, which keeps re-interpolation
   * (e.g. on coalesce) trivial.
   */
  event: StreamEvent;
}

/** Build a fresh empty placeholder map with every key set to "". */
function emptyPlaceholders(): PlaceholderMap {
  return {
    user: "",
    login: "",
    displayName: "",
    amount: "0",
    currency: "",
    bits: "",
    tier: "",
    tierLabel: "",
    count: "1",
    countPlural: "",
    message: "",
    viewers: "",
    from: "",
    rewardTitle: "",
    userInput: "",
  };
}

/**
 * Twitch sub-tier API value → display label. Unknown values pass through
 * unchanged so custom/edge tiers still render something reasonable.
 */
export function tierLabel(tier: string): string {
  switch (tier) {
    case "1000":
      return "1";
    case "2000":
      return "2";
    case "3000":
      return "3";
    default:
      return tier;
  }
}

/** Lowercase count→plural suffix helper. "" for n === 1, "s" for anything else. */
function plural(n: number): string {
  return n === 1 ? "" : "s";
}

/**
 * Extract the best available human-readable name for a user blob. Handles
 * the null-user case (anonymous cheers/donations) by returning "Anonymous".
 */
function resolveUserName(user: { displayName?: string; login?: string } | null | undefined): {
  user: string;
  login: string;
  displayName: string;
} {
  if (!user) {
    return { user: "Anonymous", login: "", displayName: "" };
  }
  const login = user.login ?? "";
  const displayName = user.displayName ?? login;
  const bestName = user.displayName || user.login || "Anonymous";
  return { user: bestName, login, displayName };
}

/**
 * Format donation minor-units → major-units string. The DonationEvent spec
 * says `amount` is in cents (or bits for cheers). For display we render
 * with two decimals for currencies and a raw integer for "BITS".
 */
function formatDonationAmount(amount: number, currency: string): string {
  if (currency === "BITS") return String(amount);
  return (amount / 100).toFixed(2);
}

/**
 * Derive a `PlaceholderMap` from any supported `StreamEvent`. Unknown event
 * kinds return a fully-empty map — the caller is responsible for gating on
 * `resolveAlert` before this gets used, but defensive defaults are cheap.
 */
export function buildPlaceholders(event: StreamEvent): PlaceholderMap {
  const p = emptyPlaceholders();

  switch (event.kind) {
    case "channel.follow": {
      const f = event as FollowEvent;
      const names = resolveUserName(f.user);
      p.user = names.user;
      p.login = names.login;
      p.displayName = names.displayName;
      return p;
    }
    case "channel.subscribe":
    case "channel.subscription.gift": {
      const s = event as SubEvent;
      const names = resolveUserName(s.user);
      p.user = names.user;
      p.login = names.login;
      p.displayName = names.displayName;
      p.tier = s.tier;
      p.tierLabel = tierLabel(s.tier);
      // We don't carry a true bulk-gift count today (normalize layer emits
      // one SubEvent per gifted sub). Coalesce in the Runtime bumps this
      // at display time. See README concern on bulk-gift fan-in.
      p.count = "1";
      p.countPlural = plural(1);
      return p;
    }
    case "channel.cheer": {
      const c = event as CheerEvent;
      const names = resolveUserName(c.user);
      p.user = names.user;
      p.login = names.login;
      p.displayName = names.displayName;
      p.bits = String(c.bits);
      p.amount = String(c.bits);
      p.currency = "BITS";
      p.message = c.message ?? "";
      return p;
    }
    case "channel.raid": {
      const r = event as RaidEvent;
      const names = resolveUserName(r.from);
      p.user = names.user;
      p.login = names.login;
      p.displayName = names.displayName;
      p.from = names.displayName || names.user;
      p.viewers = String(r.viewers);
      return p;
    }
    case "donation": {
      const d = event as DonationEvent;
      const names = resolveUserName(d.user);
      p.user = names.user;
      p.login = names.login;
      p.displayName = names.displayName;
      p.amount = formatDonationAmount(d.amount, d.currency);
      p.currency = d.currency;
      p.message = d.message ?? "";
      return p;
    }
    case "channel.channel_points_custom_reward_redemption.add": {
      const r = event as RedeemEvent;
      const names = resolveUserName(r.user);
      p.user = names.user;
      p.login = names.login;
      p.displayName = names.displayName;
      p.rewardTitle = r.rewardTitle;
      p.userInput = r.userInput ?? "";
      return p;
    }
    case "chat.message": {
      const m = event as ChatMessage;
      const names = resolveUserName(m.user);
      p.user = names.user;
      p.login = names.login;
      p.displayName = names.displayName;
      p.message = m.plain;
      return p;
    }
    default:
      return p;
  }
}

/**
 * Lightweight `{key}` interpolation. Unknown keys and keys whose values are
 * not plain strings collapse to "". The regex only matches a single pass —
 * nested placeholders (e.g. a value that itself contains `{foo}`) are left
 * literal, which also means user-supplied data can't hijack the template
 * by embedding further placeholders.
 */
export function interpolate(template: string, placeholders: PlaceholderMap): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_match, key: string) => {
    const value = (placeholders as unknown as Record<string, unknown>)[key];
    return typeof value === "string" ? value : "";
  });
}

/**
 * Map a `StreamEvent` to the AlertBox template key it should render under.
 * Returns `null` for events we don't celebrate in the alert box (chat,
 * redemptions — those have their own widgets).
 */
export function eventKindToAlertKind(event: StreamEvent): AlertKind | null {
  switch (event.kind) {
    case "channel.follow":
      return "follow";
    case "channel.subscribe":
      return (event as SubEvent).isGift ? "subGift" : "subscribe";
    case "channel.subscription.gift":
      return "subGift";
    case "channel.cheer":
      return "cheer";
    case "channel.raid":
      return "raid";
    case "donation":
      return "donation";
    default:
      return null;
  }
}

/**
 * Apply the threshold gate for a given alert kind. Returns true when the
 * event clears the gate and should proceed into the queue.
 */
export function passesThreshold(kind: AlertKind, event: StreamEvent, threshold: number): boolean {
  if (threshold <= 0) return true;
  switch (kind) {
    case "cheer":
      return (event as CheerEvent).bits >= threshold;
    case "raid":
      return (event as RaidEvent).viewers >= threshold;
    case "subGift":
      // We don't have a real bulk count — approximate with cumulativeMonths
      // (per task spec) so very long streaks can still gate meaningfully.
      // For single gifts this is effectively a pass-through when threshold
      // is <= 1.
      return ((event as SubEvent).cumulativeMonths ?? 1) >= threshold;
    case "donation":
      return (event as DonationEvent).amount >= threshold;
    default:
      return true;
  }
}

/**
 * Fully resolve a `StreamEvent` into a `ResolvedAlert` ready for rendering,
 * respecting the widget's per-event template gating. Returns `null` when:
 *   - the event kind isn't something AlertBox handles,
 *   - the corresponding template is disabled,
 *   - or the event is below the template's threshold.
 */
export function resolveAlert(event: StreamEvent, widgetProps: AlertBoxProps): ResolvedAlert | null {
  const kind = eventKindToAlertKind(event);
  if (!kind) return null;

  const tpl: EventTemplate = widgetProps[kind];
  if (!tpl.enabled) return null;
  if (!passesThreshold(kind, event, tpl.threshold)) return null;

  const placeholders = buildPlaceholders(event);

  return {
    kind,
    title: interpolate(tpl.title, placeholders),
    subtitle: interpolate(tpl.subtitle, placeholders),
    accent: tpl.accent,
    mediaImage: tpl.media.imageUrl,
    mediaAudio: tpl.media.audioUrl,
    mediaVolume: tpl.media.audioVolume,
    receivedAt: event.receivedAt,
    event,
  };
}

/**
 * Re-interpolate an alert after mutating its placeholder counts/bits in a
 * coalesce merge. Exposed so the Runtime can cheaply update the card
 * subtitle without re-walking `resolveAlert`.
 */
export function renderWithPlaceholders(tplField: string, placeholders: PlaceholderMap): string {
  return interpolate(tplField, placeholders);
}

/** Convenience helper exposed for tests — pluralize + stringify a count. */
export function countParts(n: number): { count: string; countPlural: string } {
  return { count: String(n), countPlural: plural(n) };
}
