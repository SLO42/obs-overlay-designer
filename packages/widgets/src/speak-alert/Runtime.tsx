import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type {
  CheerEvent,
  DonationEvent,
  Effect,
  FollowEvent,
  RaidEvent,
  RedeemEvent,
  StreamEvent,
  SubEvent,
  Widget,
} from "@obs/core";
import { isDefaultBus, useEventBus } from "@obs/core";
import { playEffect } from "@obs/effects";
import {
  BUILTIN_PROFILES,
  parseEmotionTags,
  SpeakQueue,
  type Segment,
  type SpeakEvent,
  type SpeakHandle,
} from "@obs/tts";
import type { SpeakAlertProps, EmotionAnimation } from "./schema";
import styles from "./Runtime.module.css";

export interface SpeakAlertRuntimeProps {
  widget: Widget<SpeakAlertProps>;
}

/** Maps the schema's `fontFamily` enum to the DS CSS custom property. */
const FONT_VAR: Record<SpeakAlertProps["fontFamily"], string> = {
  sans: "var(--font-sans)",
  display: "var(--font-display)",
  mono: "var(--font-mono)",
};

/**
 * Accent color fallback map when `accentFromSource` is on. Anything not in
 * this table (e.g. donation from "streamlabs") falls back to `accentOverride`.
 */
const SOURCE_ACCENTS: Record<string, string> = {
  "streamteam-tip": "#8b5cf6",
  "twitch-cheer": "#f5b95a",
};

/** Flat placeholder map used by both template interpolations. */
interface Placeholders {
  user: string;
  login: string;
  displayName: string;
  amount: string;
  currency: string;
  bits: string;
  message: string;
  viewers: string;
  from: string;
  rewardTitle: string;
  userInput: string;
  tier: string;
  tierLabel: string;
}

function emptyPlaceholders(): Placeholders {
  return {
    user: "",
    login: "",
    displayName: "",
    amount: "0",
    currency: "",
    bits: "",
    message: "",
    viewers: "",
    from: "",
    rewardTitle: "",
    userInput: "",
    tier: "",
    tierLabel: "",
  };
}

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

function formatDonationAmount(amount: number, currency: string): string {
  if (currency === "BITS") return String(amount);
  return (amount / 100).toFixed(2);
}

/** Twitch sub-tier API value → display label. */
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
 * Derive placeholders for any event kind SpeakAlert subscribes to. We duplicate
 * a small subset of AlertBox's `buildPlaceholders` rather than reach across
 * because AlertBox's map has AlertBox-specific semantics (e.g. bulk-gift
 * pluralization) that SpeakAlert doesn't need.
 */
function buildPlaceholders(event: StreamEvent): Placeholders {
  const p = emptyPlaceholders();
  switch (event.kind) {
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
    case "channel.subscribe":
    case "channel.subscription.gift": {
      const s = event as SubEvent;
      const names = resolveUserName(s.user);
      p.user = names.user;
      p.login = names.login;
      p.displayName = names.displayName;
      p.tier = s.tier;
      p.tierLabel = tierLabel(s.tier);
      return p;
    }
    case "channel.follow": {
      const f = event as FollowEvent;
      const names = resolveUserName(f.user);
      p.user = names.user;
      p.login = names.login;
      p.displayName = names.displayName;
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
    case "channel.channel_points_custom_reward_redemption.add": {
      const r = event as RedeemEvent;
      const names = resolveUserName(r.user);
      p.user = names.user;
      p.login = names.login;
      p.displayName = names.displayName;
      p.rewardTitle = r.rewardTitle;
      p.userInput = r.userInput ?? "";
      p.message = r.userInput ?? "";
      return p;
    }
    default:
      return p;
  }
}

/**
 * Lightweight `{key}` interpolation. Unknown keys collapse to "". Matches
 * AlertBox's grammar so user muscle-memory carries over.
 */
function interpolate(template: string, placeholders: Placeholders): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_match, key: string) => {
    const value = (placeholders as unknown as Record<string, unknown>)[key];
    return typeof value === "string" ? value : "";
  });
}

/**
 * Threshold/source gate. Returns true when the event should enqueue given
 * the widget's per-kind toggles + thresholds. Events SpeakAlert doesn't
 * subscribe to never reach here (the useEffect only wires `onKind` for
 * enabled kinds), but we still defensively check here so tests can emit
 * on the bus regardless of props and still see the gate behave.
 */
function shouldAccept(event: StreamEvent, props: SpeakAlertProps): boolean {
  switch (event.kind) {
    case "donation":
      if (!props.speakDonation) return false;
      return (event as DonationEvent).amount >= props.minDonationAmount;
    case "channel.cheer":
      if (!props.speakCheer) return false;
      return (event as CheerEvent).bits >= props.minCheerBits;
    case "channel.subscribe":
    case "channel.subscription.gift":
      return props.speakSubscribe;
    case "channel.follow":
      return props.speakFollow;
    case "channel.raid":
      return props.speakRaid;
    case "channel.channel_points_custom_reward_redemption.add":
      return props.speakRedeem;
    default:
      return false;
  }
}

/** Resolved accent color for a given event under the current props. */
function resolveAccent(event: StreamEvent, props: SpeakAlertProps): string {
  if (!props.accentFromSource) return props.accentOverride;
  if (event.kind === "donation") {
    const src = (event as DonationEvent).source;
    return SOURCE_ACCENTS[src] ?? props.accentOverride;
  }
  if (event.kind === "channel.cheer") {
    return SOURCE_ACCENTS["twitch-cheer"] ?? props.accentOverride;
  }
  return props.accentOverride;
}

/** An item pending (or currently) display. */
interface QueuedSpeech {
  id: string;
  title: string;
  speakText: string;
  accent: string;
  event: StreamEvent;
  /** Pre-parsed segments from `speakText` — reused for rendering + TTS. */
  segments: Segment[];
}

/**
 * Derive an `Effect` descriptor for the given emotion animation. The five
 * registered `@obs/effects` players each take different knobs; we pick
 * sensible per-type mappings driven by the configured `intensity`.
 *
 * Returns `null` when the animation is `"none"` so callers can short-circuit.
 */
function effectForAnimation(animation: EmotionAnimation, defaultColor: string): Effect | null {
  const intensity = animation.intensity;
  switch (animation.effect) {
    case "none":
      return null;
    case "shake":
      return {
        id: "seg",
        type: "shake",
        durationMs: 400,
        amplitude: 8 * intensity,
      };
    case "flash":
      return {
        id: "seg",
        type: "flash",
        durationMs: 400,
        color: defaultColor,
      };
    case "zoom-punch":
      return {
        id: "seg",
        type: "zoom-punch",
        durationMs: 400,
        scale: 1 + 0.08 * intensity,
      };
    default:
      return null;
  }
}

/**
 * Split a segment's text into word runs + whitespace runs, preserving
 * character offsets into the segment. Word highlighting looks up the
 * boundary charIndex inside this array.
 */
interface WordRun {
  /** True for word runs, false for whitespace runs. */
  isWord: boolean;
  /** Character offset into the segment's text at which this run starts. */
  start: number;
  /** Inclusive-exclusive end offset. */
  end: number;
  text: string;
}

function splitWords(text: string): WordRun[] {
  if (text.length === 0) return [];
  const runs: WordRun[] = [];
  const re = /\s+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push({
        isWord: true,
        start: last,
        end: m.index,
        text: text.slice(last, m.index),
      });
    }
    runs.push({
      isWord: false,
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    runs.push({
      isWord: true,
      start: last,
      end: text.length,
      text: text.slice(last),
    });
  }
  return runs;
}

/**
 * SpeakAlert Runtime. Subscribes to enabled event kinds, builds a queue of
 * speech-carrying alert cards, renders them one at a time in an entrance →
 * hold → exit cycle, and drives `@obs/tts`'s SpeakQueue so the message is
 * read aloud with emotion-synced animations.
 */
export function SpeakAlertRuntime({ widget }: SpeakAlertRuntimeProps) {
  const props = widget.props;
  const bus = useEventBus();
  const designMode = isDefaultBus(bus);

  // Props ref so the bus handler can read the latest values without
  // resubscribing on every tick (which would drop in-flight speech).
  const propsRef = useRef(props);
  propsRef.current = props;

  const [queue, setQueue] = useState<QueuedSpeech[]>([]);
  const [current, setCurrent] = useState<QueuedSpeech | null>(null);
  const [state, setState] = useState<"in" | "idle" | "out">("idle");
  /**
   * The segment + character the SpeechSynthesis boundary event most recently
   * reported. Used to drive word highlighting. Null = no highlight.
   */
  const [boundary, setBoundary] = useState<{
    segmentIndex: number;
    charIndex: number;
    charLength: number;
  } | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const displayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRef = useRef<SpeakHandle | null>(null);
  const queueClassRef = useRef<SpeakQueue | null>(null);
  if (queueClassRef.current === null) {
    // Built lazily so it's only constructed when a Runtime actually mounts.
    // Reuse the same instance across speaks — SpeakQueue cancels its own
    // prior handle when `speak()` is called again, so queueing is safe.
    queueClassRef.current = new SpeakQueue();
  }

  const clearTimers = useCallback(() => {
    if (displayTimerRef.current) clearTimeout(displayTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    displayTimerRef.current = null;
    exitTimerRef.current = null;
    nextTimerRef.current = null;
  }, []);

  // Subscribe to the bus once (ignoring design mode). We always subscribe to
  // every kind the widget *could* consume and gate inside the handler, so
  // prop toggles take effect without re-subscribing.
  useEffect(() => {
    if (designMode) return;
    const handle = (event: StreamEvent) => {
      const currentProps = propsRef.current;
      if (!shouldAccept(event, currentProps)) return;
      const placeholders = buildPlaceholders(event);
      const title = interpolate(currentProps.titleTemplate, placeholders);
      const speakText = interpolate(currentProps.speakTemplate, placeholders);
      const accent = resolveAccent(event, currentProps);
      const segments = parseEmotionTags(speakText, {
        defaultEmotion: currentProps.ttsDefaultEmotion,
      }).filter((s) => s.text.length > 0);

      const queuedItem: QueuedSpeech = {
        id: event.id,
        title,
        speakText,
        accent,
        event,
        segments,
      };

      setQueue((prev) => {
        let next = [...prev, queuedItem];
        const max = propsRef.current.maxQueue;
        if (next.length > max) {
          next = next.slice(next.length - max);
        }
        return next;
      });
    };
    const off = bus.on(handle);
    return off;
  }, [bus, designMode]);

  // Drive: pop from queue → display → hold → exit. Runs whenever `current`
  // clears or a new item arrives.
  useEffect(() => {
    if (designMode) return;
    if (current !== null) return;
    if (queue.length === 0) return;

    const [head, ...rest] = queue;
    if (!head) return;

    setQueue(rest);
    setCurrent(head);
    setState("in");
    setBoundary(null);
  }, [queue, current, designMode]);

  // Effect handler for the currently-displayed card. Coordinates TTS +
  // animation + exit timing. We re-run whenever `current` flips.
  useEffect(() => {
    if (designMode) return;
    if (!current) return;

    const live = propsRef.current;
    const shouldSpeak = live.ttsEnabled && current.segments.length > 0;
    let cancelled = false;

    const scheduleExit = () => {
      if (cancelled) return;
      if (displayTimerRef.current) clearTimeout(displayTimerRef.current);
      displayTimerRef.current = setTimeout(() => {
        setState("out");
        exitTimerRef.current = setTimeout(() => {
          setCurrent(null);
          setState("idle");
          setBoundary(null);
          if (live.spacingMs > 0) {
            nextTimerRef.current = setTimeout(() => {
              // Nudge the queue effect to re-run in case `current` is already
              // null (the pop effect gates on queue + current).
              setQueue((q) => q.slice());
            }, live.spacingMs);
          }
        }, 300);
      }, live.displayMs);
    };

    if (!shouldSpeak) {
      // No TTS path: just hold for displayMs then exit.
      scheduleExit();
      return () => {
        cancelled = true;
        if (displayTimerRef.current) clearTimeout(displayTimerRef.current);
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      };
    }

    const speakQueue = queueClassRef.current!;
    const handle = speakQueue.speak(current.speakText, {
      profiles: BUILTIN_PROFILES,
      defaultEmotion: live.ttsDefaultEmotion,
      rateMultiplier: live.ttsRate,
      volumeMultiplier: live.ttsVolume,
      lang: live.ttsLang,
    });
    handleRef.current = handle;

    const off = handle.onEvent((evt: SpeakEvent) => {
      if (cancelled) return;
      if (evt.type === "start") {
        if (live.animateOnSegments) {
          const emotion = evt.segment.emotion;
          const animation = live.emotionAnimations[emotion];
          if (animation && animation.effect !== "none" && cardRef.current) {
            const effect = effectForAnimation(animation, live.accentOverride);
            if (effect) playEffect(cardRef.current, effect);
          }
        }
      } else if (evt.type === "boundary") {
        if (live.highlightCurrentWord) {
          setBoundary({
            segmentIndex: evt.segmentIndex,
            charIndex: evt.charIndex,
            charLength: evt.charLength,
          });
        }
      } else if (evt.type === "finish") {
        // Speech finished — start the hold-then-exit timer. If `displayMs`
        // is very short the card may already have scheduled its own exit
        // on mount; scheduleExit clears any prior timer so we don't double
        // up.
        scheduleExit();
      }
    });

    // Belt-and-braces: even if the speech backend never emits `finish`
    // (some drivers swallow errors), fall back to a wall-clock timeout so
    // a card never gets pinned forever. We use displayMs + a generous
    // 10s speech slack so normal short speech still exits from the
    // `finish` handler.
    const fallbackTimer = setTimeout(() => {
      if (!cancelled) scheduleExit();
    }, live.displayMs + 10_000);

    return () => {
      cancelled = true;
      off();
      clearTimeout(fallbackTimer);
      try {
        handle.cancel();
      } catch {
        /* handle already finalized */
      }
      if (handleRef.current === handle) handleRef.current = null;
      if (displayTimerRef.current) clearTimeout(displayTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    };
  }, [current, designMode]);

  // Unmount-only safety net: cancel any in-flight speech and clear timers.
  useEffect(() => {
    const speakQueue = queueClassRef.current;
    return () => {
      clearTimers();
      try {
        speakQueue?.cancelAll();
      } catch {
        /* noop */
      }
    };
  }, [clearTimers]);

  // Design mode preview. We parse the canned message so the tag → animation
  // mapping is visible in the card copy (colored per emotion), but we never
  // actually speak.
  const previewCard = useMemo<QueuedSpeech | null>(() => {
    if (!designMode) return null;
    const title = "Preview · $3.00 USD";
    const speakText = "(excited) great stream! (shy) just wanted to say hi";
    const segments = parseEmotionTags(speakText, {
      defaultEmotion: props.ttsDefaultEmotion,
    }).filter((s) => s.text.length > 0);
    return {
      id: "preview",
      title,
      speakText,
      accent: props.accentOverride,
      event: {
        kind: "donation",
        id: "preview",
        source: "streamteam-tip",
        user: { displayName: "Preview" },
        amount: 300,
        currency: "USD",
        message: speakText,
        receivedAt: 0,
      } as DonationEvent,
      segments,
    };
  }, [designMode, props.accentOverride, props.ttsDefaultEmotion]);

  const displayed = designMode ? previewCard : current;

  if (!displayed) {
    return <div className={styles.root} data-widget-kind="speak-alert" data-empty="" />;
  }

  return (
    <div className={styles.root} data-widget-kind="speak-alert">
      {designMode ? <span className={styles.previewLabel}>Preview</span> : null}
      <SpeakCard
        ref={cardRef}
        card={displayed}
        props={props}
        boundary={designMode ? null : boundary}
        state={designMode ? undefined : state}
      />
    </div>
  );
}

interface SpeakCardProps {
  card: QueuedSpeech;
  props: SpeakAlertProps;
  boundary: { segmentIndex: number; charIndex: number; charLength: number } | null;
  /** Omitted in design mode to suppress animations. */
  state?: "in" | "idle" | "out";
}

const SpeakCard = forwardRef<HTMLDivElement, SpeakCardProps>(function SpeakCard(
  { card, props, boundary, state },
  ref,
) {
  const cardStyle: CSSProperties = {
    padding: props.cardPadding,
    borderRadius: props.cardRadius,
    backgroundColor: props.cardBg,
    ["--accent-color" as never]: card.accent,
  };

  const titleStyle: CSSProperties = {
    fontFamily: FONT_VAR[props.fontFamily],
    fontSize: props.titleSize,
  };

  const messageStyle: CSSProperties = {
    fontSize: props.messageSize,
  };

  const className = [styles.card, props.textShadow ? styles.textShadow : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={ref}
      className={className}
      style={cardStyle}
      data-speak-kind={card.event.kind}
      data-anim-entrance={props.entranceAnim}
      data-anim-exit={props.exitAnim}
      data-state={state}
    >
      <span className={styles.accentBar} aria-hidden="true" />
      <div className={styles.body}>
        <h3 className={styles.title} style={titleStyle} data-speak-title>
          {card.title}
        </h3>
        {card.segments.length > 0 ? (
          <p className={styles.message} style={messageStyle} data-speak-message>
            {card.segments.map((segment, i) => (
              <SegmentSpan
                key={i}
                segment={segment}
                segmentIndex={i}
                boundary={boundary}
                highlightColor={props.highlightColor}
                highlightEnabled={props.highlightCurrentWord}
              />
            ))}
          </p>
        ) : null}
      </div>
    </div>
  );
});

interface SegmentSpanProps {
  segment: Segment;
  segmentIndex: number;
  boundary: { segmentIndex: number; charIndex: number; charLength: number } | null;
  highlightColor: string;
  highlightEnabled: boolean;
}

/**
 * Renders one parsed segment as a sequence of word/whitespace spans. The word
 * whose character range contains the active boundary index gets the
 * highlight styling. Whitespace spans are rendered as-is so text layout
 * matches the spoken utterance exactly.
 */
function SegmentSpan({
  segment,
  segmentIndex,
  boundary,
  highlightColor,
  highlightEnabled,
}: SegmentSpanProps) {
  const runs = useMemo(() => splitWords(segment.text), [segment.text]);

  return (
    <span data-segment-index={segmentIndex} data-segment-emotion={segment.emotion}>
      {runs.map((run, i) => {
        if (!run.isWord) {
          // Whitespace preserved so the rendered paragraph matches the
          // utterance — otherwise boundary offsets and visible word
          // positions could drift.
          return <span key={i}>{run.text}</span>;
        }
        const isActive =
          highlightEnabled &&
          boundary !== null &&
          boundary.segmentIndex === segmentIndex &&
          boundary.charIndex >= run.start &&
          boundary.charIndex < run.end;
        const style: CSSProperties = isActive
          ? {
              backgroundColor: `${highlightColor}22`,
              outline: `2px solid ${highlightColor}`,
              outlineOffset: "0",
            }
          : {};
        return (
          <span
            key={i}
            className={styles.word}
            style={style}
            data-word
            data-active={isActive ? "" : undefined}
          >
            {run.text}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Test hook — exposes the internal helpers so specs can unit-test them
 * without mounting the component.
 */
export const __internals = {
  buildPlaceholders,
  interpolate,
  shouldAccept,
  resolveAccent,
  effectForAnimation,
  splitWords,
};
