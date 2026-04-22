import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ChatFragment, ChatMessage, Widget } from "@obs/core";
import { isDefaultBus, useEventBus } from "@obs/core";
import type { EmoteWallProps } from "./schema";
import { spawnParticle, stepParticle, type Particle, type World } from "./physics";
import styles from "./Runtime.module.css";

export interface EmoteWallRuntimeProps {
  widget: Widget<EmoteWallProps>;
}

/**
 * Twitch CDN template — mirrors `@obs/widgets/chat-feed`'s `buildTwitchEmoteUrl`.
 * We inline it here (rather than depend on chat-feed) because the widget
 * package's barrel imports both; coupling them via a shared helper file is
 * overkill for a one-line string template.
 */
function buildTwitchEmoteUrl(emoteId: string): string {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/static/dark/2.0`;
}

/**
 * Roles considered "subscriber-or-above" for the `onlySubscribers` gate. Mods
 * + broadcasters + VIPs get a free pass since they run the channel.
 */
const SUBSCRIBER_ROLES: ReadonlyArray<ChatMessage["user"]["roles"][number]> = [
  "subscriber",
  "vip",
  "mod",
  "broadcaster",
];

/** Returns the src URL for a qualifying fragment, or null when it should be skipped. */
function fragmentToEmoteSrc(fragment: ChatFragment, props: EmoteWallProps): string | null {
  if (fragment.type === "emote") {
    if (!props.includeFirstPartyEmotes) return null;
    if (fragment.emoteUrl) return fragment.emoteUrl;
    if (fragment.emoteId) return buildTwitchEmoteUrl(fragment.emoteId);
    return null;
  }
  if (fragment.type === "cheermote") {
    if (!props.includeCheermotes) return null;
    if (fragment.emoteUrl) return fragment.emoteUrl;
    if (fragment.emoteId) return buildTwitchEmoteUrl(fragment.emoteId);
    return null;
  }
  return null;
}

/**
 * Six inlined SVG data URIs — one per color — so design mode renders even
 * without a network connection. Size is 32x32; the Runtime scales them to
 * `particleSize` via the img's width/height so the swatches still feel
 * emote-like.
 */
const PREVIEW_EMOTE_SRCS = ["#ff6b8a", "#f5b95a", "#4ade80", "#4da3ff", "#a78bfa", "#e6e8ef"].map(
  (color) =>
    `data:image/svg+xml;utf8,` +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${color}"/></svg>`,
    ),
);

/** Build six frozen preview particles spread across the widget box. */
function buildPreviewParticles(
  width: number,
  height: number,
  size: number,
  now: number,
): Particle[] {
  // Distribute particles in a 3x2 grid, inset from the box edges so they're
  // visible even in a tight preview.
  const cols = 3;
  const rows = 2;
  const stepX = width / (cols + 1);
  const stepY = height / (rows + 1);
  const particles: Particle[] = [];
  for (let i = 0; i < 6; i += 1) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    particles.push({
      id: `preview-${i}`,
      // Non-null assertion is safe — PREVIEW_EMOTE_SRCS has exactly 6
      // entries and `i` is bounded above by the loop's < 6 guard.
      src: PREVIEW_EMOTE_SRCS[i]!,
      x: stepX * (c + 1) - size / 2,
      y: stepY * (r + 1) - size / 2,
      vx: 0,
      vy: 0,
      rot: (i - 2) * 8, // slight preview tilt so it doesn't feel static
      rotSpeed: 0,
      size,
      bornAt: now,
      lifetimeMs: Number.POSITIVE_INFINITY,
      mode: "drop",
    });
  }
  return particles;
}

/**
 * Compute a particle's current opacity based on age + fadeOutMs. Returns 1
 * until the final `fadeOutMs` window, then linearly decays to 0 at the end
 * of the particle's life. Design-mode particles pass `Infinity` as
 * `lifetimeMs` so this always returns 1.
 */
function opacityForAge(ageMs: number, lifetimeMs: number, fadeOutMs: number): number {
  if (!Number.isFinite(lifetimeMs)) return 1;
  if (fadeOutMs <= 0) return 1;
  const fadeStart = lifetimeMs - fadeOutMs;
  if (ageMs <= fadeStart) return 1;
  const t = (ageMs - fadeStart) / fadeOutMs;
  return Math.max(0, 1 - t);
}

/**
 * EmoteWall Runtime. Collects emote + cheermote fragments from
 * `chat.message` events and animates them as particles using the pure
 * physics module. A single rAF loop advances every particle; ResizeObserver
 * keeps the simulation box dimensions in sync with the widget's transform.
 */
export function EmoteWallRuntime({ widget }: EmoteWallRuntimeProps) {
  const props = widget.props;
  const bus = useEventBus();
  const designMode = isDefaultBus(bus);

  // Props ref so the bus handler + rAF loop read live values without
  // re-subscribing on every prop edit.
  const propsRef = useRef(props);
  propsRef.current = props;

  // Ref-driven particle store. Using a ref (instead of state) for the
  // canonical list avoids a re-render per rAF frame — we pair it with a
  // lightweight version counter that we bump at most once per frame.
  const particlesRef = useRef<Particle[]>([]);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((n) => (n + 1) % 1_000_000);

  const uidRef = useRef(0);

  // Measured widget-box dimensions. The ResizeObserver below keeps these
  // in sync with the DOM; both default to 0 so the first frame doesn't
  // emit particles until we know the real dimensions.
  const rootRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // Spawn preview particles in design mode once dimensions are known.
  useEffect(() => {
    if (!designMode) return;
    const measure = () => {
      const el = rootRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      sizeRef.current = { w, h };
      particlesRef.current = buildPreviewParticles(w, h, propsRef.current.particleSize, Date.now());
      bump();
    };
    measure();
    const RO = typeof ResizeObserver !== "undefined" ? ResizeObserver : null;
    if (!RO) return;
    const ro = new RO(measure);
    if (rootRef.current) ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, [designMode, props.particleSize]);

  // Live dimensions tracker in non-design mode.
  useEffect(() => {
    if (designMode) return;
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    };
    measure();
    const RO = typeof ResizeObserver !== "undefined" ? ResizeObserver : null;
    if (!RO) return;
    const ro = new RO(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designMode]);

  // Subscribe to chat.message and enqueue particles per qualifying fragment.
  useEffect(() => {
    if (designMode) return;
    const off = bus.onKind("chat.message", (event) => {
      const live = propsRef.current;

      if (live.onlySubscribers) {
        const roles = event.user.roles ?? [];
        const passes = roles.some((r) => SUBSCRIBER_ROLES.includes(r));
        if (!passes) return;
      }

      const { w, h } = sizeRef.current;
      // If we haven't measured yet, fall back to any non-zero defaults so
      // tests running in happy-dom (where clientWidth is often 0) still
      // receive particles.
      const width = w > 0 ? w : 720;
      const height = h > 0 ? h : 520;

      const now = Date.now();
      const toSpawn: Particle[] = [];
      for (const frag of event.fragments) {
        const src = fragmentToEmoteSrc(frag, live);
        if (!src) continue;
        for (let i = 0; i < live.spawnPerEmote; i += 1) {
          uidRef.current += 1;
          const anchor = {
            x: Math.random() * Math.max(1, width - live.particleSize),
            y: Math.random() * Math.max(1, height - live.particleSize),
          };
          toSpawn.push(
            spawnParticle({
              id: `${event.id}-${uidRef.current}`,
              src,
              anchor,
              jitter: live.spawnJitterPx,
              size: live.particleSize,
              mode: live.mode,
              now,
              lifetimeMs: live.lifetimeMs,
              rotationEnabled: live.particleRotation,
              rotationSpeedMax: live.rotationSpeedMax,
              initialVelocityMin: live.initialVelocityMin,
              initialVelocityMax: live.initialVelocityMax,
            }),
          );
        }
      }

      if (toSpawn.length === 0) return;

      let next = [...particlesRef.current, ...toSpawn];
      if (next.length > live.maxParticles) {
        next = next.slice(next.length - live.maxParticles);
      }
      particlesRef.current = next;
      bump();
    });
    return () => {
      off();
    };
  }, [bus, designMode]);

  // rAF loop — advances every particle by dt, filters dead ones, and bumps
  // a tick so React rerenders. In design mode we freeze physics by passing
  // dt=0 but still render (the preview particles are static anyway).
  useEffect(() => {
    let rafId: number | null = null;
    let prev: number | null = null;

    const frame = (now: number) => {
      const live = propsRef.current;
      const { w, h } = sizeRef.current;
      const width = w > 0 ? w : 720;
      const height = h > 0 ? h : 520;

      const world: World = {
        width,
        height,
        gravity: live.gravity,
        bounce: live.bounce,
        floatRiseSpeed: live.floatRiseSpeed,
        floatWobbleAmp: live.floatWobbleAmp,
        floatWobbleFreq: live.floatWobbleFreq,
      };

      if (prev === null) prev = now;
      const dtMs = designMode ? 0 : Math.max(0, now - prev);
      prev = now;

      // Skip the integration path when there's nothing to do — dev-mode
      // previews have static particles so we only need to render once.
      if (particlesRef.current.length > 0 && !designMode) {
        const nextList: Particle[] = [];
        for (const p of particlesRef.current) {
          const stepped = stepParticle(p, dtMs, world);
          if (stepped) nextList.push(stepped);
        }
        // Only bump state if the list actually changed — avoids a
        // needless re-render when nothing spawned and nothing died.
        if (nextList.length !== particlesRef.current.length) {
          particlesRef.current = nextList;
          bump();
        } else {
          particlesRef.current = nextList;
          // Still need the component to render so transforms update.
          bump();
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [designMode]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      particlesRef.current = [];
    };
  }, []);

  // Consume `tick` so eslint-plugin-react-hooks recognises the dep —
  // actually referenced by the render below so React rerenders when we
  // bump().
  void tick;

  const rootStyle: CSSProperties = useMemo(
    () => ({
      backgroundColor: props.bg,
      borderRadius: props.borderRadius,
    }),
    [props.bg, props.borderRadius],
  );

  const now = Date.now();

  return (
    <div
      ref={rootRef}
      className={styles.root}
      style={rootStyle}
      data-widget-kind="emote-wall"
      data-particle-count={particlesRef.current.length}
    >
      {designMode ? <span className={styles.previewLabel}>Preview</span> : null}
      {particlesRef.current.map((p) => {
        const age = now - p.bornAt;
        const opacity = opacityForAge(age, p.lifetimeMs, props.fadeOutMs);
        return (
          <img
            key={p.id}
            className={styles.particle}
            src={p.src}
            alt=""
            draggable={false}
            data-particle=""
            data-particle-mode={p.mode}
            style={{
              width: p.size,
              height: p.size,
              transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
}

/** Exposed for tests — the Runtime uses these internally. */
export const __internals = {
  fragmentToEmoteSrc,
  opacityForAge,
  buildPreviewParticles,
  buildTwitchEmoteUrl,
  SUBSCRIBER_ROLES,
};
