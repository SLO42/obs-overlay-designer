import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { StreamEvent, Widget } from "@obs/core";
import { isDefaultBus, useEventBus } from "@obs/core";
import { Icon, type IconName } from "@obs/design-system";
import type { AlertBoxProps } from "./schema";
import {
  buildPlaceholders,
  countParts,
  interpolate,
  resolveAlert,
  type AlertKind,
  type ResolvedAlert,
} from "./templates";
import styles from "./Runtime.module.css";

export interface AlertBoxRuntimeProps {
  widget: Widget<AlertBoxProps>;
}

/** Maps the schema's `fontFamily` enum to the DS CSS custom property. */
const FONT_VAR: Record<AlertBoxProps["fontFamily"], string> = {
  sans: "var(--font-sans)",
  display: "var(--font-display)",
  mono: "var(--font-mono)",
};

/** Per-alert-kind Lucide icon for the card badge. */
const KIND_ICON: Record<AlertKind, IconName> = {
  follow: "Heart",
  subscribe: "Star",
  subGift: "Star",
  cheer: "Gem",
  raid: "Zap",
  donation: "CircleDollarSign",
};

/**
 * Event kinds AlertBox subscribes to. Kept in sync with the registration's
 * `eventsConsumed` — duplicated here because the subscription is per-kind.
 */
const SUBSCRIBED_KINDS = [
  "channel.follow",
  "channel.subscribe",
  "channel.subscription.gift",
  "channel.cheer",
  "channel.raid",
  "donation",
] as const;

/**
 * Mutable shape used inside the queue. We store the full event so coalesce
 * can re-derive placeholders with the merged count/bits without touching
 * the original `StreamEvent` objects on the bus.
 */
interface QueuedAlert extends ResolvedAlert {
  /** How many events this entry represents (1 by default; bumped on coalesce). */
  mergedCount: number;
  /** For cheer: running total of bits across coalesced emits. */
  mergedBits: number;
  /** Used to check the coalesce window against a new incoming event. */
  enqueuedAt: number;
}

/** One-shot audio playback guarded against autoplay policy errors. */
function playAudio(url: string, volume: number): void {
  if (!url) return;
  try {
    const el = new Audio(url);
    el.volume = Math.max(0, Math.min(1, volume));
    // OBS autoplay generally works but the DOM still returns a promise —
    // swallow rejections so a single broken URL can't crash the widget.
    void el.play().catch(() => {
      /* swallow — autoplay can reject in non-OBS previews */
    });
  } catch {
    /* constructing Audio on a bad URL shouldn't crash the overlay */
  }
}

/**
 * Build the static preview alert used when the Runtime is mounted without
 * an `OverlayBusProvider` (i.e. the builder canvas). Mirrors what a real
 * follow event would look like, so positioning + styling feels accurate
 * before test events start firing.
 */
function buildPreviewAlert(props: AlertBoxProps): ResolvedAlert {
  const placeholders = buildPlaceholders({
    kind: "channel.follow",
    id: "preview",
    user: { id: "preview", login: "preview", displayName: "Preview" },
    receivedAt: Date.now(),
  });
  return {
    kind: "follow",
    title: interpolate(props.follow.title, placeholders),
    subtitle: interpolate(props.follow.subtitle, placeholders),
    accent: props.follow.accent,
    mediaImage: props.follow.media.imageUrl,
    mediaAudio: "",
    mediaVolume: 0,
    receivedAt: 0,
    event: {
      kind: "channel.follow",
      id: "preview",
      user: { id: "preview", login: "preview", displayName: "Preview" },
      receivedAt: 0,
    },
  };
}

/**
 * Attempt to coalesce a fresh incoming alert into the tail of `queue`. If
 * the tail matches (same kind + same user + within coalesceWindowMs), the
 * tail is mutated in place (counts merged, copy re-interpolated) and the
 * caller skips the enqueue step.
 *
 * Returns the new queue reference — unchanged when no merge occurred,
 * otherwise a new array so React re-renders.
 */
function tryCoalesce(
  queue: QueuedAlert[],
  incoming: QueuedAlert,
  widgetProps: AlertBoxProps,
  now: number,
): QueuedAlert[] | null {
  if (queue.length === 0) return null;
  const tail = queue[queue.length - 1]!;
  if (tail.kind !== incoming.kind) return null;
  if (now - tail.enqueuedAt > widgetProps.coalesceWindowMs) return null;

  // Only coalesce for kinds where summing makes sense.
  if (tail.kind === "subGift") {
    const sameUser = sameLogin(tail.event, incoming.event);
    if (!sameUser) return null;
    const merged: QueuedAlert = { ...tail };
    merged.mergedCount = tail.mergedCount + 1;
    merged.enqueuedAt = now;
    const parts = countParts(merged.mergedCount);
    const placeholders = buildPlaceholders(tail.event);
    placeholders.count = parts.count;
    placeholders.countPlural = parts.countPlural;
    merged.title = interpolate(widgetProps.subGift.title, placeholders);
    merged.subtitle = interpolate(widgetProps.subGift.subtitle, placeholders);
    const next = queue.slice(0, -1);
    next.push(merged);
    return next;
  }

  if (tail.kind === "cheer") {
    const sameUser = sameLogin(tail.event, incoming.event);
    if (!sameUser) return null;
    const merged: QueuedAlert = { ...tail };
    const incomingBits = incoming.event.kind === "channel.cheer" ? incoming.event.bits : 0;
    merged.mergedBits = tail.mergedBits + incomingBits;
    merged.enqueuedAt = now;
    const placeholders = buildPlaceholders(tail.event);
    placeholders.bits = String(merged.mergedBits);
    placeholders.amount = String(merged.mergedBits);
    merged.title = interpolate(widgetProps.cheer.title, placeholders);
    merged.subtitle = interpolate(widgetProps.cheer.subtitle, placeholders);
    const next = queue.slice(0, -1);
    next.push(merged);
    return next;
  }

  // follow/raid/donation: no coalesce — each is semantically one event.
  return null;
}

/** Best-effort login match across the two shapes of event.user we see. */
function sameLogin(a: StreamEvent, b: StreamEvent): boolean {
  const la = extractLogin(a);
  const lb = extractLogin(b);
  return !!la && !!lb && la === lb;
}

function extractLogin(e: StreamEvent): string | null {
  if ("from" in e && e.from && typeof e.from === "object") {
    return (e.from as { login?: string }).login ?? null;
  }
  if ("user" in e && e.user) {
    return (e.user as { login?: string }).login ?? null;
  }
  return null;
}

/**
 * AlertBox Runtime. Subscribes to the five-plus celebration events, queues
 * them, coalesces bursts from the same user, and flashes one card at a
 * time through an entrance → hold → exit cycle.
 */
export function AlertBoxRuntime({ widget }: AlertBoxRuntimeProps) {
  const props = widget.props;
  const bus = useEventBus();
  const designMode = isDefaultBus(bus);

  // Props ref so the bus handler can read the live values without
  // re-subscribing on every prop tick (which would drop in-flight alerts).
  const propsRef = useRef(props);
  propsRef.current = props;

  const [queue, setQueue] = useState<QueuedAlert[]>([]);
  const [current, setCurrent] = useState<QueuedAlert | null>(null);
  const [state, setState] = useState<"in" | "idle" | "out">("idle");

  const displayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (displayTimerRef.current) clearTimeout(displayTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    displayTimerRef.current = null;
    exitTimerRef.current = null;
    nextTimerRef.current = null;
  };

  // Subscribe to all alert-relevant event kinds. We keep a single handler
  // per kind (rather than a filter on `on`) so the bus doesn't have to
  // dispatch irrelevant events through our logic.
  useEffect(() => {
    if (designMode) {
      // In design mode we render the static preview card instead.
      return;
    }
    const offs: Array<() => void> = [];
    const handle = (event: StreamEvent) => {
      const resolved = resolveAlert(event, propsRef.current);
      if (!resolved) return;
      const now = event.receivedAt || Date.now();

      setQueue((prev) => {
        const incoming: QueuedAlert = {
          ...resolved,
          mergedCount: 1,
          mergedBits: event.kind === "channel.cheer" ? event.bits : 0,
          enqueuedAt: now,
        };
        const coalesced = tryCoalesce(prev, incoming, propsRef.current, now);
        let next = coalesced ?? [...prev, incoming];
        // Drop oldest if we've overflowed. `maxQueue` is always >= 1 per
        // schema so we never end up with a negative slice bound.
        const max = propsRef.current.maxQueue;
        if (next.length > max) {
          next = next.slice(next.length - max);
        }
        return next;
      });
    };

    for (const kind of SUBSCRIBED_KINDS) {
      // onKind narrows the listener arg to the matching variant per kind;
      // we widen back to StreamEvent inside the single `handle` closure
      // above, so the cast here is the type-erasure at the boundary.
      offs.push(bus.onKind(kind, handle as unknown as Parameters<typeof bus.onKind>[1]));
    }
    return () => {
      for (const off of offs) off();
      clearTimers();
    };
    // Resubscribe if the bus identity ever flips. In practice the overlay
    // keeps a single stable bus for the mount lifetime.
  }, [bus, designMode]);

  // Pull from queue → current whenever current clears. Schedules entrance
  // → hold → exit timers. All timers are owned by refs and cleaned up in
  // `clearTimers()` — this keeps prop edits (e.g. displayMs slider) from
  // leaking stale callbacks.
  useEffect(() => {
    if (designMode) return;
    if (current !== null) return;
    if (queue.length === 0) return;

    const [head, ...rest] = queue;
    if (!head) return;

    setQueue(rest);
    setCurrent(head);
    setState("in");

    const { displayMs, spacingMs } = propsRef.current;
    // Entrance → idle is implicit: the card hits the `in` keyframe and
    // settles. We schedule the exit after `displayMs`.
    displayTimerRef.current = setTimeout(() => {
      setState("out");
      // Exit keyframe duration — matches the 240ms slide / 180ms fade set
      // in the CSS. We allow 300ms to cover the longest keyframe.
      exitTimerRef.current = setTimeout(() => {
        setCurrent(null);
        setState("idle");
        // After spacing, the queue-drain effect re-runs because `current`
        // flipped to null. An explicit timer isn't required here, but we
        // still gate the *next* pop on `spacingMs` by holding `current`
        // null for the spacing window via a no-op timer.
        if (spacingMs > 0) {
          nextTimerRef.current = setTimeout(() => {
            // force rerun by toggling a state slice — we use a setQueue
            // noop to bump the effect in case of strict-mode replays.
            setQueue((q) => q.slice());
          }, spacingMs);
        }
      }, 300);
    }, displayMs);

    return () => {
      // Cleared individually so re-entry (prop edits while a card is live)
      // doesn't double-fire timers.
    };
    // We intentionally depend on `queue` so new enqueues wake the effect,
    // and on `current` so it resumes once the current card clears.
  }, [queue, current, designMode]);

  // Cleanup timers on unmount.
  useEffect(() => clearTimers, []);

  // Fire the media audio whenever `current` becomes non-null with media.
  useEffect(() => {
    if (!current) return;
    if (!current.mediaAudio) return;
    playAudio(current.mediaAudio, current.mediaVolume);
  }, [current]);

  // Preview card when there's no real bus — gives the builder something
  // to size / position against before Preview mode wires the real bus in.
  const previewAlert = useMemo<ResolvedAlert | null>(() => {
    if (!designMode) return null;
    return buildPreviewAlert(props);
  }, [designMode, props]);

  const displayed = designMode ? previewAlert : current;

  if (!displayed) {
    return <div className={styles.root} data-widget-kind="alert-box" data-empty="" />;
  }

  return (
    <div className={styles.root} data-widget-kind="alert-box">
      {designMode ? <span className={styles.previewLabel}>Preview</span> : null}
      <AlertCard alert={displayed} props={props} state={designMode ? undefined : state} />
    </div>
  );
}

interface AlertCardProps {
  alert: ResolvedAlert;
  props: AlertBoxProps;
  /** Omitted in design mode to suppress animations. */
  state?: "in" | "idle" | "out";
}

function AlertCard({ alert, props, state }: AlertCardProps) {
  const cardStyle: CSSProperties = {
    padding: props.cardPadding,
    borderRadius: props.cardRadius,
    backgroundColor: props.cardBg,
    // Surface the accent to the scoped ::before bar + badge without needing
    // a runtime CSS-module composition pass.
    ["--accent-color" as never]: alert.accent,
  };

  const titleStyle: CSSProperties = {
    fontFamily: FONT_VAR[props.fontFamily],
    fontSize: props.titleSize,
  };
  const subtitleStyle: CSSProperties = {
    fontSize: props.subtitleSize,
  };

  const className = [styles.card, props.textShadow ? styles.textShadow : null]
    .filter(Boolean)
    .join(" ");

  const iconSize = Math.max(20, Math.round(props.titleSize * 0.8));

  return (
    <div
      className={className}
      style={cardStyle}
      data-alert-kind={alert.kind}
      data-anim-entrance={props.entranceAnim}
      data-anim-exit={props.exitAnim}
      data-state={state}
    >
      <span className={styles.accentBar} aria-hidden="true" />
      {props.showBadge ? (
        <span className={styles.badge} data-alert-badge="" style={{ fontSize: iconSize }}>
          <Icon name={KIND_ICON[alert.kind]} size={iconSize} />
        </span>
      ) : null}
      <div className={styles.body}>
        <h3 className={styles.title} style={titleStyle} data-alert-title="">
          {alert.title}
        </h3>
        <p className={styles.subtitle} style={subtitleStyle} data-alert-subtitle="">
          {alert.subtitle}
        </p>
      </div>
      {alert.mediaImage ? (
        <img
          className={styles.media}
          src={alert.mediaImage}
          alt=""
          draggable={false}
          data-alert-media=""
        />
      ) : null}
    </div>
  );
}

/**
 * Pulled out for tests so they can exercise the same coalesce path the
 * Runtime uses without mounting the React component.
 */
export const __internals = {
  tryCoalesce,
  buildPreviewAlert,
};
