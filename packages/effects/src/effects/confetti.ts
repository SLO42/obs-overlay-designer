import type { Cleanup } from "../types";
import { effects } from "../registry";
import { prefersReducedMotion } from "../utils/prefersReducedMotion";
import { randomBetween } from "../utils/randomBetween";
import { resolveNow, startRafLoop } from "../utils/requestAnimationFrameLoop";

/**
 * StreamTeam palette — mirrors the design-system tokens without importing
 * the package (overlay must stay free of `@obs/design-system`). Hex values
 * map to violet-500, teal-400, amber-400, pink-400, blue-400.
 */
const PALETTE = ["#8b5cf6", "#4ade80", "#f5b95a", "#ff6b8a", "#4da3ff"] as const;

interface Piece {
  el: HTMLDivElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  bornAt: number;
  size: number;
}

/**
 * Confetti burst from the top-center of `target`. Physics: semi-implicit
 * Euler driven by the shared rAF loop helper; gravity 900 px/s^2. Pieces
 * die when they exit the target bounds + 50px margin or when `age >
 * durationMs`.
 *
 * We wrap every piece in a single container `<div>` so cleanup is a one-
 * node removal regardless of how many pieces we spawned.
 */
effects.register("confetti", (target, effect, ctx): Cleanup => {
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
  container.setAttribute("data-effect", "confetti");
  container.style.position = "absolute";
  container.style.left = "0";
  container.style.top = "0";
  container.style.right = "0";
  container.style.bottom = "0";
  container.style.pointerEvents = "none";
  container.style.overflow = "visible";
  container.style.zIndex = "9999";
  target.appendChild(container);

  const width = (target as HTMLElement).clientWidth || 320;
  const height = (target as HTMLElement).clientHeight || 180;
  const margin = 50;
  const gravity = 900;
  const duration = Math.max(1, effect.durationMs);
  const count = Math.max(0, Math.floor(effect.count));

  const pieces: Piece[] = [];
  const start = resolveNow(ctx);

  for (let i = 0; i < count; i += 1) {
    const size = randomBetween(6, 12);
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)] as string;
    const el = doc.createElement("div");
    el.setAttribute("data-confetti-piece", "");
    el.style.position = "absolute";
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.backgroundColor = color;
    el.style.willChange = "transform";
    el.style.borderRadius = "1px";
    const jitter = width * 0.1;
    const x = width / 2 + randomBetween(-jitter, jitter) - size / 2;
    const y = 0;
    el.style.left = "0";
    el.style.top = "0";
    el.style.transform = `translate(${x}px, ${y}px) rotate(0deg)`;
    container.appendChild(el);

    pieces.push({
      el,
      x,
      y,
      vx: randomBetween(-300, 300),
      vy: randomBetween(-600, -200),
      rot: 0,
      rotSpeed: randomBetween(-720, 720),
      bornAt: start,
      size,
    });
  }

  const loop = startRafLoop(ctx, (now, dtMs) => {
    const dt = dtMs / 1000;
    let alive = 0;
    for (const p of pieces) {
      if (!p.el.isConnected) continue;
      const age = now - p.bornAt;
      if (age > duration) {
        p.el.remove();
        continue;
      }
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotSpeed * dt;

      if (
        p.x + p.size < -margin ||
        p.x > width + margin ||
        p.y + p.size < -margin ||
        p.y > height + margin
      ) {
        p.el.remove();
        continue;
      }

      p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
      alive += 1;
    }

    // Stop once every piece has been removed. Returning false ends the loop.
    return alive > 0;
  });

  let done = false;
  return () => {
    if (done) return;
    done = true;
    loop.stop();
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
