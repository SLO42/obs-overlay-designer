import type { Cleanup } from "../types";
import { effects } from "../registry";
import { prefersReducedMotion } from "../utils/prefersReducedMotion";
import { pickRandom, randomBetween } from "../utils/randomBetween";
import { resolveNow, startRafLoop } from "../utils/requestAnimationFrameLoop";

/**
 * Four inline SVG data URIs used when the caller doesn't supply
 * `ctx.emoteUrls`. Kept in-package so the effects library has zero asset
 * dependency — design mode + unit tests render without any network or
 * `@obs/design-system` dependency.
 */
export const FALLBACK_EMOTE_SRCS: readonly string[] = [
  "#ff6b8a",
  "#f5b95a",
  "#4ade80",
  "#4da3ff",
].map(
  (color) =>
    `data:image/svg+xml;utf8,` +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${color}"/></svg>`,
    ),
);

interface Drop {
  el: HTMLImageElement;
  spawnX: number;
  x: number;
  y: number;
  vy: number;
  phase: number;
  bornAt: number;
}

const PARTICLE_SIZE = 32;
const SPAWN_RATE_PER_SEC = 8;
const MAX_ALIVE = 80;
const WOBBLE_FREQ_HZ = 0.8;
const WOBBLE_AMP_PX = 20;
const PARTICLE_LIFETIME_MS = 8000;

/**
 * Emote-rain: 8 emotes/second fall from the top with gentle horizontal
 * wobble. Uses the same rAF loop helper as confetti, but spawns over time
 * rather than in a single burst. Caps at `MAX_ALIVE` simultaneous particles
 * so a long `durationMs` can't balloon memory.
 *
 * Reduced motion: no-op — rain is inherently busy; downgrade would be a
 * different effect altogether.
 */
effects.register("emote-rain", (target, effect, ctx): Cleanup => {
  if (ctx?.respectReducedMotion && prefersReducedMotion()) {
    return () => {};
  }

  const doc = (target as HTMLElement).ownerDocument ?? globalThis.document;
  if (!doc || typeof doc.createElement !== "function") return () => {};

  const prevInlinePosition = (target as HTMLElement).style.position;
  const computed =
    typeof getComputedStyle === "function" ? getComputedStyle(target as HTMLElement) : null;
  const needsRelative = !computed || computed.position === "static" || computed.position === "";
  if (needsRelative) {
    (target as HTMLElement).style.position = "relative";
  }

  const container = doc.createElement("div");
  container.setAttribute("data-effect", "emote-rain");
  container.style.position = "absolute";
  container.style.left = "0";
  container.style.top = "0";
  container.style.right = "0";
  container.style.bottom = "0";
  container.style.pointerEvents = "none";
  container.style.overflow = "hidden";
  container.style.zIndex = "9999";
  target.appendChild(container);

  const emoteUrls =
    ctx?.emoteUrls && ctx.emoteUrls.length > 0 ? ctx.emoteUrls : FALLBACK_EMOTE_SRCS;

  const drops: Drop[] = [];
  const start = resolveNow(ctx);
  const duration = Math.max(1, effect.durationMs);

  // Spawn accumulator: track how many particles should have spawned by
  // elapsed time. Compare against `spawned` each frame; catches up if a
  // frame runs long.
  let spawned = 0;

  const spawnOne = (now: number, width: number) => {
    const src = pickRandom(emoteUrls);
    const img = doc.createElement("img");
    img.setAttribute("data-emote-rain-particle", "");
    img.src = src;
    img.alt = "";
    img.draggable = false;
    img.style.position = "absolute";
    img.style.width = `${PARTICLE_SIZE}px`;
    img.style.height = `${PARTICLE_SIZE}px`;
    img.style.willChange = "transform";
    img.style.userSelect = "none";
    img.style.pointerEvents = "none";
    const spawnX = randomBetween(0, Math.max(0, width - PARTICLE_SIZE));
    const spawnY = -PARTICLE_SIZE;
    img.style.left = "0";
    img.style.top = "0";
    img.style.transform = `translate(${spawnX}px, ${spawnY}px)`;
    container.appendChild(img);

    drops.push({
      el: img,
      spawnX,
      x: spawnX,
      y: spawnY,
      vy: randomBetween(100, 250),
      phase: Math.random() * Math.PI * 2,
      bornAt: now,
    });
  };

  const loop = startRafLoop(ctx, (now, dtMs) => {
    const elapsed = now - start;
    const dt = dtMs / 1000;
    const width = (target as HTMLElement).clientWidth || 320;
    const height = (target as HTMLElement).clientHeight || 180;

    // Time-gated spawn: stop spawning once `elapsed >= duration`.
    if (elapsed < duration) {
      const expected = Math.floor((elapsed / 1000) * SPAWN_RATE_PER_SEC);
      while (spawned < expected && drops.length < MAX_ALIVE) {
        spawnOne(now, width);
        spawned += 1;
      }
    }

    // Step + cull.
    for (let i = drops.length - 1; i >= 0; i -= 1) {
      const d = drops[i];
      if (!d) continue;
      const age = now - d.bornAt;
      if (age > PARTICLE_LIFETIME_MS) {
        d.el.remove();
        drops.splice(i, 1);
        continue;
      }
      d.y += d.vy * dt;
      const ageSeconds = age / 1000;
      d.x =
        d.spawnX + WOBBLE_AMP_PX * Math.sin(2 * Math.PI * WOBBLE_FREQ_HZ * ageSeconds + d.phase);
      if (d.y > height + PARTICLE_SIZE) {
        d.el.remove();
        drops.splice(i, 1);
        continue;
      }
      d.el.style.transform = `translate(${d.x}px, ${d.y}px)`;
    }

    // Stop when past duration AND no active drops remain.
    if (elapsed >= duration && drops.length === 0) return false;
    return true;
  });

  let done = false;
  return () => {
    if (done) return;
    done = true;
    loop.stop();
    // Remove any still-alive nodes defensively (loop already removed them
    // individually when they exited the bottom).
    for (const d of drops) {
      d.el.remove();
    }
    drops.length = 0;
    if (container.parentNode === target) {
      target.removeChild(container);
    }
    if (needsRelative) {
      if (prevInlinePosition) {
        (target as HTMLElement).style.position = prevInlinePosition;
      } else {
        (target as HTMLElement).style.removeProperty("position");
      }
    }
  };
});
