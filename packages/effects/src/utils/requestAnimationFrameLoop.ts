import type { EffectContext } from "../types";

/**
 * Ticker callback signature. `nowMs` is the current timestamp (from the
 * injected clock), `dtMs` is the delta since the previous tick. The return
 * value controls whether the loop continues (`true`) or stops (`false`).
 */
export type TickFn = (nowMs: number, dtMs: number) => boolean;

export interface RafLoopHandle {
  stop: () => void;
}

/**
 * Small rAF-driven ticker used by particle effects (confetti, emote-rain).
 * Honors the optional `ctx.raf`/`ctx.cancelRaf`/`ctx.now` overrides for
 * deterministic tests. Stopping is idempotent.
 */
export function startRafLoop(ctx: EffectContext | undefined, tick: TickFn): RafLoopHandle {
  const raf =
    ctx?.raf ??
    ((cb: (t: number) => void) =>
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(cb)
        : (setTimeout(() => cb(resolveNow(ctx)), 16) as unknown as number));
  const cancelRaf =
    ctx?.cancelRaf ??
    ((id: number) => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
      else clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
    });

  let rafId: number | null = null;
  let prev: number | null = null;
  let stopped = false;

  const frame = (now: number) => {
    if (stopped) return;
    if (prev === null) prev = now;
    const dt = Math.max(0, now - prev);
    prev = now;
    const keepGoing = tick(now, dt);
    if (!keepGoing) {
      stopped = true;
      return;
    }
    rafId = raf(frame);
  };

  rafId = raf(frame);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (rafId !== null) cancelRaf(rafId);
      rafId = null;
    },
  };
}

/**
 * Resolve the current timestamp, preferring the context override. Shared so
 * the loop + callers use the same clock.
 */
export function resolveNow(ctx: EffectContext | undefined): number {
  if (ctx?.now) return ctx.now();
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}
