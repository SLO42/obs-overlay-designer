import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ChatFragment, ChatMessage, Widget } from "@obs/core";
import { useEventBus } from "@obs/core";
import { Icon, type IconName } from "@obs/design-system";
import type { ChatFeedProps } from "./schema";
import styles from "./Runtime.module.css";

export interface ChatFeedRuntimeProps {
  widget: Widget<ChatFeedProps>;
}

/** Maps the schema's `fontFamily` enum to the DS CSS custom property. */
const FONT_VAR: Record<ChatFeedProps["fontFamily"], string> = {
  sans: "var(--font-sans)",
  mono: "var(--font-mono)",
};

/**
 * Role → Lucide icon name. Only the visually-distinct roles render badges;
 * `viewer` is the implicit default and produces nothing.
 */
const ROLE_ICON: Record<string, IconName> = {
  broadcaster: "Crown",
  mod: "Shield",
  vip: "Gem",
  subscriber: "Star",
};

// `noUncheckedIndexedAccess` widens CSS-module lookups to `string | undefined`;
// coercing here keeps the map shape strict.
const ROLE_CLASS: Record<string, string> = {
  broadcaster: styles.badgeBroadcaster ?? "",
  mod: styles.badgeModerator ?? "",
  vip: styles.badgeVip ?? "",
  subscriber: styles.badgeSubscriber ?? "",
};

const ROLE_DATA_VALUE: Record<string, string> = {
  broadcaster: "broadcaster",
  mod: "moderator",
  vip: "vip",
  subscriber: "subscriber",
};

/**
 * Canonical Twitch emote URL template. Mirrors `buildEmoteUrl` in
 * `@obs/twitch` — kept inlined here so the widget doesn't take a dep on
 * the whole twitch package just for a one-line string template.
 */
function buildTwitchEmoteUrl(emoteId: string): string {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/static/dark/2.0`;
}

/**
 * Deterministic HSL from a username — used when the user hasn't picked a
 * Twitch chat color. Copy of the stock Twitch name-coloring heuristic:
 * every login maps to the same color across the whole widget lifetime.
 */
function hashLoginToHue(login: string): number {
  let h = 0;
  for (let i = 0; i < login.length; i += 1) {
    h = (h * 31 + login.charCodeAt(i)) | 0;
  }
  // Unsigned mod so we don't land on a negative hue.
  return ((h % 360) + 360) % 360;
}

function usernameColor(user: ChatMessage["user"]): string {
  if (user.color) return user.color;
  return `hsl(${hashLoginToHue(user.login)}, 70%, 55%)`;
}

/** Zero-padded `HH:MM` from a millisecond epoch. */
function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

interface QueueRow {
  message: ChatMessage;
  /** Appended once; used as React key so entrance/exit is stable. */
  uid: string;
  /** Toggles the `.fading` class after `fadeAfterMs`. */
  fading: boolean;
}

/**
 * Live chat renderer. Subscribes to `chat.message` via the overlay bus
 * (`useEventBus()`), maintains a ring-buffer of the last N messages, and
 * renders them with badges + emotes + mentions.
 */
export function ChatFeedRuntime({ widget }: ChatFeedRuntimeProps) {
  const p = widget.props;
  const bus = useEventBus();

  const [rows, setRows] = useState<QueueRow[]>([]);
  // Per-row fade + removal timers. Refs so prop edits mid-life don't leak
  // pending callbacks bound to stale closures.
  const timersRef = useRef<
    Map<string, { fade?: ReturnType<typeof setTimeout>; drop?: ReturnType<typeof setTimeout> }>
  >(new Map());
  const uidCounter = useRef(0);

  // Clear all pending row timers. Called on unmount + when the subscription
  // is rebuilt.
  const clearTimers = () => {
    for (const t of timersRef.current.values()) {
      if (t.fade) clearTimeout(t.fade);
      if (t.drop) clearTimeout(t.drop);
    }
    timersRef.current.clear();
  };

  // Subscribe once. We read `maxMessages`, `fadeAfterMs`, and
  // `fadeDurationMs` off a ref snapshot inside the handler so live prop
  // edits take effect without re-subscribing (which would drop in-flight
  // messages and re-trigger entrance animations).
  const propsRef = useRef(p);
  propsRef.current = p;

  useEffect(() => {
    const off = bus.onKind("chat.message", (event) => {
      uidCounter.current += 1;
      const uid = `${event.id}-${uidCounter.current}`;

      setRows((prev) => {
        const next = [...prev, { message: event, uid, fading: false }];
        // Drop oldest to respect the live `maxMessages` value.
        const max = propsRef.current.maxMessages;
        while (next.length > max) {
          const dropped = next.shift();
          if (dropped) {
            const timers = timersRef.current.get(dropped.uid);
            if (timers?.fade) clearTimeout(timers.fade);
            if (timers?.drop) clearTimeout(timers.drop);
            timersRef.current.delete(dropped.uid);
          }
        }
        return next;
      });

      const { fadeAfterMs, fadeDurationMs } = propsRef.current;
      if (fadeAfterMs > 0) {
        const timers: {
          fade?: ReturnType<typeof setTimeout>;
          drop?: ReturnType<typeof setTimeout>;
        } = {};
        timers.fade = setTimeout(() => {
          setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, fading: true } : r)));
          timers.drop = setTimeout(() => {
            setRows((prev) => prev.filter((r) => r.uid !== uid));
            timersRef.current.delete(uid);
          }, fadeDurationMs);
        }, fadeAfterMs);
        timersRef.current.set(uid, timers);
      }
    });
    return () => {
      off();
      clearTimers();
    };
    // Reset + re-subscribe if the bus identity changes. In practice the
    // overlay provides a stable bus for the lifetime of the mount, and
    // tests replace the bus wholesale between cases.
  }, [bus]);

  // Trim synchronously when `maxMessages` drops below the current queue
  // depth — the brief says "queue trims synchronously via the schema
  // update" so the Inspector's edits feel instantaneous.
  useEffect(() => {
    setRows((prev) => {
      if (prev.length <= p.maxMessages) return prev;
      const dropped = prev.slice(0, prev.length - p.maxMessages);
      for (const d of dropped) {
        const timers = timersRef.current.get(d.uid);
        if (timers?.fade) clearTimeout(timers.fade);
        if (timers?.drop) clearTimeout(timers.drop);
        timersRef.current.delete(d.uid);
      }
      return prev.slice(prev.length - p.maxMessages);
    });
  }, [p.maxMessages]);

  const orderedRows = useMemo(() => {
    return p.alignBottom ? rows : [...rows].reverse();
  }, [rows, p.alignBottom]);

  const rootStyle: CSSProperties = {
    fontFamily: FONT_VAR[p.fontFamily],
    fontSize: p.fontSize,
    padding: p.padding,
    borderRadius: p.borderRadius,
    backgroundColor: p.backgroundColor,
    ["--line-color" as never]: p.lineColor,
  };

  const rootClass = [
    styles.root,
    p.alignBottom ? styles.alignBottom : styles.alignTop,
    styles[p.density],
  ]
    .filter(Boolean)
    .join(" ");

  const rowPadClass =
    (p.density === "compact"
      ? styles.rowCompact
      : p.density === "cozy"
        ? styles.rowCozy
        : styles.rowComfortable) ?? "";

  const entranceAnim =
    p.entranceAnim === "slide-up"
      ? "chatfeed-slide-up 180ms ease-out both"
      : p.entranceAnim === "fade"
        ? "chatfeed-fade 180ms ease-out both"
        : "none";

  return (
    <div className={rootClass} style={rootStyle} data-widget-kind="chat-feed">
      {orderedRows.map((row) => (
        <ChatRow
          key={row.uid}
          row={row}
          props={p}
          rowPadClass={rowPadClass}
          entranceAnim={entranceAnim}
        />
      ))}
    </div>
  );
}

interface ChatRowProps {
  row: QueueRow;
  props: ChatFeedProps;
  rowPadClass: string;
  entranceAnim: string;
}

function ChatRow({ row, props: p, rowPadClass, entranceAnim }: ChatRowProps) {
  const { message, fading } = row;
  const color = usernameColor(message.user);

  const className = [
    styles.row,
    rowPadClass,
    p.textShadow && styles.textShadow,
    fading && styles.fading,
  ]
    .filter(Boolean)
    .join(" ");

  const rowStyle: CSSProperties = {
    ["--fade-ms" as never]: `${p.fadeDurationMs}ms`,
    ["--entrance-anim" as never]: entranceAnim,
  };

  return (
    <div className={className} style={rowStyle} data-chat-row="">
      {p.showTimestamps ? (
        <span className={styles.timestamp}>{formatTimestamp(message.receivedAt)}</span>
      ) : null}
      {p.showBadges ? <Badges roles={message.user.roles} fontSize={p.fontSize} /> : null}
      <span className={styles.displayName} style={{ color }} data-display-name="">
        {message.user.displayName}
      </span>
      <span className={styles.colon}>:</span>
      <span className={styles.message}>
        {message.fragments.map((frag, i) => (
          <Fragment
            key={`${frag.type}-${i}`}
            fragment={frag}
            mentionColor={p.mentionColor}
            fontSize={p.fontSize}
          />
        ))}
      </span>
    </div>
  );
}

interface BadgesProps {
  roles: ChatMessage["user"]["roles"];
  fontSize: number;
}

function Badges({ roles, fontSize }: BadgesProps) {
  // Deduplicate and preserve the semantically meaningful roles in a stable
  // order: broadcaster first (top authority), then moderator, vip, subscriber.
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const role of ["broadcaster", "mod", "vip", "subscriber"]) {
    if (roles.includes(role as (typeof roles)[number]) && !seen.has(role)) {
      seen.add(role);
      ordered.push(role);
    }
  }
  if (ordered.length === 0) return null;

  const iconSize = Math.max(10, Math.round(fontSize * 0.75));
  return (
    <span className={styles.badges}>
      {ordered.map((role) => {
        const name = ROLE_ICON[role];
        if (!name) return null;
        return (
          <span
            key={role}
            className={`${styles.badge} ${ROLE_CLASS[role] ?? ""}`}
            data-role={ROLE_DATA_VALUE[role] ?? role}
          >
            <Icon name={name} size={iconSize} />
          </span>
        );
      })}
    </span>
  );
}

interface FragmentProps {
  fragment: ChatFragment;
  mentionColor: string;
  fontSize: number;
}

function Fragment({ fragment, mentionColor, fontSize }: FragmentProps) {
  switch (fragment.type) {
    case "emote": {
      const url =
        fragment.emoteUrl ?? (fragment.emoteId ? buildTwitchEmoteUrl(fragment.emoteId) : null);
      if (!url) {
        // Malformed emote fragment — fall through to plain text so the
        // message content is still readable.
        return <span>{fragment.text}</span>;
      }
      const h = Math.round(fontSize * 1.4);
      return (
        <img
          className={styles.emote}
          src={url}
          alt={fragment.text}
          title={fragment.text}
          data-emote-id={fragment.emoteId}
          style={{ height: h }}
          draggable={false}
        />
      );
    }
    case "mention":
      return (
        <span className={styles.mention} style={{ color: mentionColor }} data-mention="">
          {fragment.text}
        </span>
      );
    case "cheermote":
      return (
        <span className={styles.cheer} data-cheer="" data-bits={fragment.bits ?? 0}>
          {fragment.text}
        </span>
      );
    case "text":
    default:
      return <span>{fragment.text}</span>;
  }
}
