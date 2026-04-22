import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  CheerEvent,
  DonationEvent,
  FollowEvent,
  RaidEvent,
  RedeemEvent,
  StreamEvent,
  SubEvent,
  ChatMessage,
  Widget,
} from "@obs/core";
import { isDefaultBus, useEventBus } from "@obs/core";
import { Icon, type IconName } from "@obs/design-system";
import type { EventTickerProps } from "./schema";
import styles from "./Runtime.module.css";

export interface EventTickerRuntimeProps {
  widget: Widget<EventTickerProps>;
}

/** Per-schema font-family enum → design-system CSS custom property. */
const FONT_VAR: Record<EventTickerProps["fontFamily"], string> = {
  sans: "var(--font-sans)",
  display: "var(--font-display)",
  mono: "var(--font-mono)",
};

/**
 * A ticker "kind" is a slightly wider union than the AlertBox kinds — we
 * also celebrate redemptions and chat messages here. Kept local to this
 * module so the registration's `eventsConsumed` stays the source of truth.
 */
type TickerKind =
  | "follow"
  | "subscribe"
  | "subGift"
  | "cheer"
  | "raid"
  | "redeem"
  | "donation"
  | "chat";

const KIND_ICON: Record<TickerKind, IconName> = {
  follow: "Heart",
  subscribe: "Star",
  subGift: "Star",
  cheer: "Gem",
  raid: "Zap",
  redeem: "Gift",
  donation: "CircleDollarSign",
  chat: "MessageSquare",
};

const KIND_ACCENT: Record<TickerKind, string> = {
  follow: "#4ade80",
  subscribe: "#a78bfa",
  subGift: "#a78bfa",
  cheer: "#f5b95a",
  raid: "#ff6b8a",
  redeem: "#a78bfa",
  donation: "#4da3ff",
  chat: "#e6e8ef",
};

/** Entry state carried in the ticker queue. */
interface Entry {
  uid: string;
  kind: TickerKind;
  /** Login used for same-user coalesce matching. "" disables matching. */
  login: string;
  /** Bold username displayed in the pill. */
  user: string;
  /** Plain-text half of the pill ("followed", "cheered 500 bits", …). */
  text: string;
  /** Timestamp for `entryLifetimeMs` cleanup + relative-time rendering. */
  createdAt: number;
  /** Touched on coalesce so the rest window restarts. */
  updatedAt: number;
  /** cheer-only: running bits total (used so subsequent coalesces can sum). */
  bits?: number;
  /** subGift-only: running count. */
  count?: number;
  /** donation-only: running amount + currency (currency must match to merge). */
  amount?: number;
  currency?: string;
}

/** `1000` → `1`, unknown values pass through unchanged. */
function tierLabel(tier: string): string {
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

/**
 * Bits render as a raw integer; every other currency uses minor-unit →
 * major-unit conversion with two decimals and the currency suffix. Mirrors
 * AlertBox's donation formatting but surfaced as a standalone helper so
 * tests can exercise it directly.
 */
export function formatAmount(amount: number, currency: string): string {
  if (currency === "BITS") return String(amount);
  return `${(amount / 100).toFixed(2)} ${currency}`;
}

/**
 * Compact relative-time formatter used in the per-entry `showTimestamps`
 * badge. Returns `"now"` below 5 seconds, then clamps up through seconds /
 * minutes / hours / days. Values older than a day collapse to a single `Xd`
 * bucket — the ticker will have dropped them via `entryLifetimeMs` long
 * before then, but we still render something sensible if someone bumps the
 * lifetime to 10 minutes.
 */
export function relativeTime(now: number, then: number): string {
  const deltaMs = Math.max(0, now - then);
  const s = Math.floor(deltaMs / 1000);
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

/** Best-effort human name for an event's user blob. */
function bestName(user: { displayName?: string; login?: string } | null | undefined): {
  user: string;
  login: string;
} {
  if (!user) return { user: "Anonymous", login: "" };
  const name = user.displayName || user.login || "Anonymous";
  return { user: name, login: user.login ?? "" };
}

/**
 * Map a StreamEvent to a fresh Entry — returns null when the event kind
 * isn't one the ticker handles (paranoia: the subscription gates this too).
 */
function entryFromEvent(event: StreamEvent, now: number, uid: string): Entry | null {
  switch (event.kind) {
    case "channel.follow": {
      const f = event as FollowEvent;
      const { user, login } = bestName(f.user);
      return {
        uid,
        kind: "follow",
        login,
        user,
        text: "followed",
        createdAt: now,
        updatedAt: now,
      };
    }
    case "channel.subscribe": {
      const s = event as SubEvent;
      if (s.isGift) {
        const { user, login } = bestName(s.user);
        return {
          uid,
          kind: "subGift",
          login,
          user,
          text: `gifted subs × 1`,
          createdAt: now,
          updatedAt: now,
          count: 1,
        };
      }
      const { user, login } = bestName(s.user);
      return {
        uid,
        kind: "subscribe",
        login,
        user,
        text: `subscribed · Tier ${tierLabel(s.tier)}`,
        createdAt: now,
        updatedAt: now,
      };
    }
    case "channel.subscription.gift": {
      const s = event as SubEvent;
      const { user, login } = bestName(s.user);
      return {
        uid,
        kind: "subGift",
        login,
        user,
        text: `gifted subs × 1`,
        createdAt: now,
        updatedAt: now,
        count: 1,
      };
    }
    case "channel.cheer": {
      const c = event as CheerEvent;
      const { user, login } = bestName(c.user);
      return {
        uid,
        kind: "cheer",
        login,
        user,
        text: `cheered ${c.bits} bits`,
        createdAt: now,
        updatedAt: now,
        bits: c.bits,
      };
    }
    case "channel.raid": {
      const r = event as RaidEvent;
      const { user, login } = bestName(r.from);
      return {
        uid,
        kind: "raid",
        login,
        // raid pills read "raid from <user> · <viewers>", but our pill
        // layout puts <user> in bold before <text>. We keep the same
        // shape by rendering the user's name in bold, and making `text`
        // carry the rest of the description.
        user,
        text: `raided · ${r.viewers}`,
        createdAt: now,
        updatedAt: now,
      };
    }
    case "channel.channel_points_custom_reward_redemption.add": {
      const r = event as RedeemEvent;
      const { user, login } = bestName(r.user);
      return {
        uid,
        kind: "redeem",
        login,
        user,
        text: `redeemed ${r.rewardTitle}`,
        createdAt: now,
        updatedAt: now,
      };
    }
    case "donation": {
      const d = event as DonationEvent;
      const { user, login } = bestName(d.user);
      return {
        uid,
        kind: "donation",
        login,
        user,
        text: `donated ${formatAmount(d.amount, d.currency)}`,
        createdAt: now,
        updatedAt: now,
        amount: d.amount,
        currency: d.currency,
      };
    }
    case "chat.message": {
      const m = event as ChatMessage;
      const { user, login } = bestName(m.user);
      const plain = (m.plain ?? "").slice(0, 80);
      return {
        uid,
        kind: "chat",
        login,
        user,
        text: `: ${plain}`,
        createdAt: now,
        updatedAt: now,
      };
    }
    default:
      return null;
  }
}

/**
 * Try to merge `incoming` into the tail of `entries` when the two share a
 * kind + login and the tail was updated within `coalesceWindowMs`. Only
 * cheer / subGift / donation collapse; the other kinds always append.
 *
 * Returns a new entries array on merge, or null when no merge occurred.
 */
function tryCoalesce(
  entries: Entry[],
  incoming: Entry,
  coalesceWindowMs: number,
  now: number,
): Entry[] | null {
  if (entries.length === 0) return null;
  const tail = entries[entries.length - 1]!;
  if (tail.kind !== incoming.kind) return null;
  // Empty login never matches — anonymous cheers/donations stay separate.
  if (!tail.login || tail.login !== incoming.login) return null;
  if (now - tail.updatedAt > coalesceWindowMs) return null;

  if (tail.kind === "cheer") {
    const bits = (tail.bits ?? 0) + (incoming.bits ?? 0);
    const merged: Entry = {
      ...tail,
      bits,
      text: `cheered ${bits} bits`,
      updatedAt: now,
    };
    return [...entries.slice(0, -1), merged];
  }

  if (tail.kind === "subGift") {
    const count = (tail.count ?? 1) + 1;
    const merged: Entry = {
      ...tail,
      count,
      text: `gifted subs × ${count}`,
      updatedAt: now,
    };
    return [...entries.slice(0, -1), merged];
  }

  if (tail.kind === "donation") {
    // Currency mismatch falls through to a new entry — we can't meaningfully
    // sum USD + EUR without an FX table.
    if (tail.currency !== incoming.currency) return null;
    const amount = (tail.amount ?? 0) + (incoming.amount ?? 0);
    const currency = tail.currency ?? "";
    const merged: Entry = {
      ...tail,
      amount,
      text: `donated ${formatAmount(amount, currency)}`,
      updatedAt: now,
    };
    return [...entries.slice(0, -1), merged];
  }

  // follow / subscribe / raid / redeem / chat: no coalesce.
  return null;
}

/** Is this event kind enabled under the current props? */
function eventEnabled(event: StreamEvent, props: EventTickerProps): boolean {
  switch (event.kind) {
    case "channel.follow":
      return props.includeFollow;
    case "channel.subscribe":
      return (event as SubEvent).isGift ? props.includeSubGift : props.includeSubscribe;
    case "channel.subscription.gift":
      return props.includeSubGift;
    case "channel.cheer":
      return props.includeCheer;
    case "channel.raid":
      return props.includeRaid;
    case "channel.channel_points_custom_reward_redemption.add":
      return props.includeRedeem;
    case "donation":
      return props.includeDonation;
    case "chat.message":
      return props.includeChat;
    default:
      return false;
  }
}

/**
 * Kinds the ticker subscribes to. Duplicated (intentionally) with the
 * registration's `eventsConsumed` — the subscription needs a concrete
 * tuple at the hook call site.
 */
const SUBSCRIBED_KINDS = [
  "channel.follow",
  "channel.subscribe",
  "channel.subscription.gift",
  "channel.cheer",
  "channel.raid",
  "channel.channel_points_custom_reward_redemption.add",
  "donation",
  "chat.message",
] as const;

/** Preview entries rendered in Design mode (no real bus). */
function buildPreviewEntries(now: number): Entry[] {
  return [
    {
      uid: "preview-cheer",
      kind: "cheer",
      login: "preview",
      user: "Preview",
      text: "cheered 100 bits",
      createdAt: now,
      updatedAt: now,
      bits: 100,
    },
    {
      uid: "preview-follow",
      kind: "follow",
      login: "preview",
      user: "Preview",
      text: "followed",
      createdAt: now,
      updatedAt: now,
    },
    {
      uid: "preview-raid",
      kind: "raid",
      login: "preview",
      user: "Preview",
      text: "raided · 1,200",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/**
 * EventTicker Runtime. Subscribes to the celebration-event kinds, queues
 * entries into a horizontal track, and scrolls the track via an rAF loop.
 *
 * Pause/resume mechanics: the rAF loop checks a `paused` flag before
 * advancing `offset`. `paused` flips true when the track is narrower than
 * the container (nothing to scroll) or when `restAfterMs` has elapsed with
 * no new/updated entries. A fresh entry resumes the loop and re-baselines
 * the rAF clock so the first frame doesn't jump.
 */
export function EventTickerRuntime({ widget }: EventTickerRuntimeProps) {
  const props = widget.props;
  const bus = useEventBus();
  const designMode = isDefaultBus(bus);

  // Props ref so the bus handler reads live values without re-subscribing.
  const propsRef = useRef(props);
  propsRef.current = props;

  const [entries, setEntries] = useState<Entry[]>(() =>
    designMode ? buildPreviewEntries(Date.now()) : [],
  );
  const uidCounter = useRef(0);
  // Timestamp of the most recent entry arrival/update. Drives the rest
  // window — the rAF loop pauses when `now - lastActivity > restAfterMs`.
  const lastActivityRef = useRef<number>(Date.now());

  // Subscription — subscribes to every relevant kind and funnels into a
  // single handler that reads live props via `propsRef`. Design mode skips
  // subscriptions entirely; preview entries are seeded once in `useState`.
  useEffect(() => {
    if (designMode) return;
    const offs: Array<() => void> = [];
    const handle = (event: StreamEvent) => {
      const live = propsRef.current;
      if (!eventEnabled(event, live)) return;
      const now = event.receivedAt || Date.now();
      uidCounter.current += 1;
      const uid = `${event.id}-${uidCounter.current}`;
      const incoming = entryFromEvent(event, now, uid);
      if (!incoming) return;

      setEntries((prev) => {
        const coalesced = tryCoalesce(prev, incoming, live.coalesceWindowMs, now);
        let next = coalesced ?? [...prev, incoming];
        if (next.length > live.maxEntries) {
          next = next.slice(next.length - live.maxEntries);
        }
        return next;
      });
      lastActivityRef.current = now;
    };

    for (const kind of SUBSCRIBED_KINDS) {
      // Widen back to StreamEvent inside `handle`; the per-kind listener
      // typing here is an erasure at the boundary.
      offs.push(bus.onKind(kind, handle as unknown as Parameters<typeof bus.onKind>[1]));
    }
    return () => {
      for (const off of offs) off();
    };
  }, [bus, designMode]);

  // Lifetime cleanup: drop entries older than `entryLifetimeMs` every
  // second. Cheap: O(n) per tick, n capped by `maxEntries`.
  useEffect(() => {
    if (designMode) return;
    const id = setInterval(() => {
      const live = propsRef.current;
      const now = Date.now();
      setEntries((prev) => {
        const kept = prev.filter((e) => now - e.createdAt <= live.entryLifetimeMs);
        return kept.length === prev.length ? prev : kept;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [designMode]);

  // -----------------------------------------------------------------------
  // Scroll animation
  // -----------------------------------------------------------------------

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  /**
   * Measured `scrollWidth` of the track after layout. 0 before first
   * measure — the track is visibility-hidden for that first frame so we
   * don't flash an unpositioned row. The rAF loop reads `scrollWidth`
   * directly so state here is really just driving the visibility flip.
   */
  const [trackWidth, setTrackWidth] = useState(0);

  // Measure the track whenever `entries` change or the surrounding box
  // resizes. ResizeObserver handles both the intrinsic (entries added)
  // and extrinsic (widget resized by the builder) cases.
  useEffect(() => {
    if (designMode) return;
    const track = trackRef.current;
    const root = rootRef.current;
    if (!track || !root) return;

    const measure = () => {
      setTrackWidth(track.scrollWidth);
    };
    measure();
    // `ResizeObserver` isn't available in older happy-dom versions; fall
    // back to the initial measure. Tests don't assert on the scroll
    // transform so the missing observer is harmless.
    const RO = typeof ResizeObserver !== "undefined" ? ResizeObserver : null;
    if (!RO) return;
    const ro = new RO(measure);
    ro.observe(track);
    ro.observe(root);
    return () => ro.disconnect();
  }, [entries, designMode]);

  // rAF loop — advances `offset`, rebases on wrap, and applies the
  // transform. All state lives in refs so the effect body re-closes
  // infrequently (only when design mode flips).
  useEffect(() => {
    if (designMode) return;
    const track = trackRef.current;
    if (!track) return;

    let offset = 0;
    let prev: number | null = null;
    let rafId: number | null = null;

    const frame = (now: number) => {
      const live = propsRef.current;
      // `trackWidth` / `containerWidth` come from state — read the latest
      // DOM values directly so the loop doesn't need a dep-churning closure.
      const tw = track.scrollWidth;
      const cw = track.parentElement?.clientWidth ?? 0;

      const nothingToScroll = tw === 0 || tw <= cw;
      const idle = now - lastActivityRef.current > live.restAfterMs;
      const paused = nothingToScroll || idle;

      if (paused) {
        // Rebase so resume doesn't jump.
        prev = null;
        if (nothingToScroll) {
          offset = 0;
          track.style.transform = `translateX(0px)`;
        }
      } else {
        if (prev === null) prev = now;
        const dt = now - prev;
        prev = now;
        offset += (live.pixelsPerSecond * dt) / 1000;
        // Keep offset bounded so floating point doesn't drift.
        if (tw > 0) offset = offset % tw;
        const translate = live.direction === "left" ? -(offset % tw) : (offset % tw) - tw;
        track.style.transform = `translateX(${translate}px)`;
      }
      rafId = requestAnimationFrame(frame);
    };

    // `performance.now()` isn't strictly needed here — rAF passes us a
    // monotonic timestamp directly. The initial offset is 0 so the first
    // paint is already at the start position.
    rafId = requestAnimationFrame(frame);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [designMode]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const rootStyle: CSSProperties = {
    fontFamily: FONT_VAR[props.fontFamily],
    fontSize: props.fontSize,
  };

  const rootClass = [styles.root, props.textShadow ? styles.textShadow : null]
    .filter(Boolean)
    .join(" ");

  const trackClass = [styles.track, trackWidth === 0 && !designMode ? styles.trackMeasuring : null]
    .filter(Boolean)
    .join(" ");

  const isEmpty = entries.length === 0;

  return (
    <div
      ref={rootRef}
      className={rootClass}
      style={rootStyle}
      data-widget-kind="event-ticker"
      data-empty={isEmpty ? "" : undefined}
    >
      {designMode ? <span className={styles.previewLabel}>Preview</span> : null}
      <div
        ref={trackRef}
        className={trackClass}
        role="list"
        data-ticker-track=""
        style={{ gap: `${props.gapPx}px` }}
      >
        {entries.map((entry) => (
          <EntryPill
            key={entry.uid}
            entry={entry}
            props={props}
            now={designMode ? entry.createdAt : Date.now()}
          />
        ))}
      </div>
    </div>
  );
}

interface EntryPillProps {
  entry: Entry;
  props: EventTickerProps;
  now: number;
}

function EntryPill({ entry, props, now }: EntryPillProps) {
  const accent = KIND_ACCENT[entry.kind];
  const iconSize = Math.max(10, Math.round(props.fontSize * 0.9));

  const style: CSSProperties = {
    padding: `${props.padY}px ${props.padX}px`,
    borderRadius: props.borderRadius,
    backgroundColor: props.bg,
    color: props.textColor,
    gap: `${props.gap}px`,
    ["--accent-color" as never]: accent,
  };

  return (
    <div
      className={styles.entry}
      role="listitem"
      style={style}
      data-ticker-entry=""
      data-ticker-kind={entry.kind}
    >
      {props.showIcons ? (
        <span className={styles.entryIcon} data-ticker-icon="">
          <Icon name={KIND_ICON[entry.kind]} size={iconSize} />
        </span>
      ) : null}
      <b className={styles.entryUser} data-ticker-user="">
        {entry.user}
      </b>
      <span className={styles.entryText} data-ticker-text="">
        {entry.text}
      </span>
      {props.showTimestamps ? (
        <time className={styles.entryTime} data-ticker-time="">
          {relativeTime(now, entry.createdAt)}
        </time>
      ) : null}
    </div>
  );
}

/**
 * Exposed for tests so they can exercise the coalesce / entry mapping paths
 * without mounting the React component.
 */
export const __internals = {
  tryCoalesce,
  entryFromEvent,
  eventEnabled,
  buildPreviewEntries,
};
