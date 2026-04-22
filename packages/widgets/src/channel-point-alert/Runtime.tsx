import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RedeemEvent, Widget } from "@obs/core";
import { isDefaultBus, useEventBus } from "@obs/core";
import { Icon } from "@obs/design-system";
import type { ChannelPointAlertProps } from "./schema";
import styles from "./Runtime.module.css";

export interface ChannelPointAlertRuntimeProps {
  widget: Widget<ChannelPointAlertProps>;
}

/** Maps the schema's `fontFamily` enum to the DS CSS custom property. */
const FONT_VAR: Record<ChannelPointAlertProps["fontFamily"], string> = {
  sans: "var(--font-sans)",
  display: "var(--font-display)",
  mono: "var(--font-mono)",
};

/**
 * The redemption placeholder set — narrower than AlertBox's (no bits /
 * tiers / viewers / currency), so we keep a small inline Record instead of
 * pulling AlertBox's StreamEvent-aware templates helpers. The duplication is
 * intentional: see README note on `interpolate`.
 */
interface RedeemPlaceholders {
  user: string;
  displayName: string;
  login: string;
  rewardTitle: string;
  userInput: string;
}

/**
 * Lightweight `{key}` interpolation. Mirrors AlertBox's helper but scoped
 * to the redemption-only placeholder set. Unknown keys collapse to "".
 */
function interpolate(template: string, map: RedeemPlaceholders): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_match, key: string) => {
    const value = (map as unknown as Record<string, unknown>)[key];
    return typeof value === "string" ? value : "";
  });
}

/** Build a placeholder map from a real redemption event. */
function placeholdersFromEvent(event: RedeemEvent): RedeemPlaceholders {
  const displayName = event.user.displayName || event.user.login || "";
  const login = event.user.login || "";
  return {
    user: displayName || login || "Anonymous",
    displayName,
    login,
    rewardTitle: event.rewardTitle,
    userInput: event.userInput ?? "",
  };
}

/**
 * Preview placeholder fixture used in design mode. Matches the spec's
 * "Preview redeemed Sample reward" baseline so the builder canvas shows
 * something representative without a live bus.
 */
const PREVIEW_PLACEHOLDERS: RedeemPlaceholders = {
  user: "Preview",
  displayName: "Preview",
  login: "preview",
  rewardTitle: "Sample reward",
  userInput: "",
};

/** Decide whether a redemption event passes the widget's filters. */
function eventMatches(event: RedeemEvent, props: ChannelPointAlertProps): boolean {
  if (props.rewardId) {
    return event.rewardId === props.rewardId;
  }
  if (props.rewardTitleContains) {
    return event.rewardTitle.toLowerCase().includes(props.rewardTitleContains.toLowerCase());
  }
  return true;
}

/** Fully-interpolated alert card. */
interface QueuedAlert {
  uid: string;
  title: string;
  subtitle: string;
  userInput: string;
}

/** One-shot audio playback, guarded against autoplay policy errors. */
function playAudio(url: string, volume: number): void {
  if (!url) return;
  try {
    const el = new Audio(url);
    el.volume = Math.max(0, Math.min(1, volume));
    void el.play().catch(() => {
      /* swallow — autoplay can reject in non-OBS previews */
    });
  } catch {
    /* constructing Audio on a bad URL shouldn't crash the overlay */
  }
}

/**
 * ChannelPointAlert Runtime. Subscribes to redemption events, applies the
 * per-widget filter, queues one card at a time, and animates entrance →
 * hold → exit. Unlike AlertBox we don't coalesce — every redemption is its
 * own celebration.
 */
export function ChannelPointAlertRuntime({ widget }: ChannelPointAlertRuntimeProps) {
  const props = widget.props;
  const bus = useEventBus();
  const designMode = isDefaultBus(bus);

  // Props ref so the bus handler reads the live values without
  // re-subscribing on every prop edit (that would drop in-flight alerts).
  const propsRef = useRef(props);
  propsRef.current = props;

  const [queue, setQueue] = useState<QueuedAlert[]>([]);
  const [current, setCurrent] = useState<QueuedAlert | null>(null);
  const [state, setState] = useState<"in" | "idle" | "out">("idle");
  const uidCounter = useRef(0);

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

  // Subscribe to redemption events.
  useEffect(() => {
    if (designMode) return;
    const off = bus.onKind("channel.channel_points_custom_reward_redemption.add", (event) => {
      const live = propsRef.current;
      if (!eventMatches(event, live)) return;
      const placeholders = placeholdersFromEvent(event);
      uidCounter.current += 1;
      const incoming: QueuedAlert = {
        uid: `${event.id}-${uidCounter.current}`,
        title: interpolate(live.title, placeholders),
        subtitle: interpolate(live.subtitle, placeholders),
        userInput: placeholders.userInput,
      };
      setQueue((prev) => {
        let next = [...prev, incoming];
        const max = propsRef.current.maxQueue;
        if (next.length > max) {
          next = next.slice(next.length - max);
        }
        return next;
      });
    });
    return () => {
      off();
      clearTimers();
    };
  }, [bus, designMode]);

  // Pull from queue → current whenever current clears. Schedules
  // entrance → hold → exit timers.
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
    displayTimerRef.current = setTimeout(() => {
      setState("out");
      exitTimerRef.current = setTimeout(() => {
        setCurrent(null);
        setState("idle");
        if (spacingMs > 0) {
          nextTimerRef.current = setTimeout(() => {
            // Force a rerun of the drain effect once spacing is honored.
            setQueue((q) => q.slice());
          }, spacingMs);
        }
      }, 300);
    }, displayMs);
    // queue / current are the drivers. See AlertBox for the same pattern.
  }, [queue, current, designMode]);

  // Unmount cleanup.
  useEffect(() => clearTimers, []);

  // Fire audio whenever a new card becomes `current`.
  useEffect(() => {
    if (!current) return;
    const live = propsRef.current;
    if (!live.audioUrl) return;
    playAudio(live.audioUrl, live.audioVolume);
  }, [current]);

  // Design-mode static preview card.
  const previewAlert = useMemo<QueuedAlert | null>(() => {
    if (!designMode) return null;
    return {
      uid: "preview",
      title: interpolate(props.title, PREVIEW_PLACEHOLDERS),
      subtitle: interpolate(props.subtitle, PREVIEW_PLACEHOLDERS),
      userInput: PREVIEW_PLACEHOLDERS.userInput,
    };
  }, [designMode, props.title, props.subtitle]);

  const displayed = designMode ? previewAlert : current;

  if (!displayed) {
    return <div className={styles.root} data-widget-kind="channel-point-alert" data-empty="" />;
  }

  return (
    <div className={styles.root} data-widget-kind="channel-point-alert">
      {designMode ? <span className={styles.previewLabel}>Preview</span> : null}
      <AlertCard alert={displayed} props={props} state={designMode ? undefined : state} />
    </div>
  );
}

interface AlertCardProps {
  alert: QueuedAlert;
  props: ChannelPointAlertProps;
  /** Omitted in design mode to suppress animations. */
  state?: "in" | "idle" | "out";
}

function AlertCard({ alert, props, state }: AlertCardProps) {
  const cardStyle: CSSProperties = {
    padding: props.cardPadding,
    borderRadius: props.cardRadius,
    backgroundColor: props.cardBg,
    ["--accent-color" as never]: props.accent,
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
  // Spec: "Hide the subtitle if `userInput` is empty — avoids a blank line for
  // rewards that don't take input." We gate purely on the event's userInput,
  // not on the interpolated `alert.subtitle` — a user might template the
  // subtitle with `{user}` which would always be non-empty.
  const showSubtitle = !(props.hideEmptySubtitle && alert.userInput === "");

  return (
    <div
      className={className}
      style={cardStyle}
      data-alert-kind="channel-point"
      data-anim-entrance={props.entranceAnim}
      data-anim-exit={props.exitAnim}
      data-state={state}
    >
      <span className={styles.accentBar} aria-hidden="true" />
      {props.showBadge ? (
        <span className={styles.badge} data-alert-badge="" style={{ fontSize: iconSize }}>
          <Icon name="Gift" size={iconSize} />
        </span>
      ) : null}
      <div className={styles.body}>
        <h3 className={styles.title} style={titleStyle} data-alert-title="">
          {alert.title}
        </h3>
        {showSubtitle ? (
          <p className={styles.subtitle} style={subtitleStyle} data-alert-subtitle="">
            {alert.subtitle}
          </p>
        ) : null}
      </div>
      {props.imageUrl ? (
        <img
          className={styles.media}
          src={props.imageUrl}
          alt=""
          draggable={false}
          data-alert-media=""
        />
      ) : null}
    </div>
  );
}

/**
 * Exposed for tests so they can exercise the filter / interpolation path
 * without mounting the React component.
 */
export const __internals = {
  interpolate,
  placeholdersFromEvent,
  eventMatches,
  PREVIEW_PLACEHOLDERS,
};
