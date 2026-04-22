import { describe, expect, it, vi } from "vitest";
import "../../index";
import { effects } from "../../registry";

/**
 * Build a deterministic clock + raf pair. `raf(cb)` queues callbacks that
 * `tick(dtMs)` invokes with an advanced timestamp. This keeps physics
 * tests fast + repeatable without real timers.
 */
function makeManualClock(start = 0) {
  let now = start;
  let nextId = 1;
  const queued: Array<{ id: number; cb: (t: number) => void }> = [];
  return {
    now: () => now,
    raf: (cb: (t: number) => void) => {
      const id = nextId++;
      queued.push({ id, cb });
      return id;
    },
    cancelRaf: (id: number) => {
      const idx = queued.findIndex((q) => q.id === id);
      if (idx >= 0) queued.splice(idx, 1);
    },
    tick: (dtMs: number) => {
      now += dtMs;
      const toRun = queued.splice(0, queued.length);
      for (const q of toRun) q.cb(now);
    },
    pending: () => queued.length,
  };
}

function play(target: HTMLElement, clock: ReturnType<typeof makeManualClock>, count = 6) {
  const player = effects.get("confetti");
  if (!player) throw new Error("confetti player not registered");
  return player(
    target,
    { id: "t", type: "confetti", count, durationMs: 1000 },
    { now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf },
  );
}

function attach(el: HTMLElement) {
  // Give the target a measured size so the loop can bound physics.
  Object.defineProperty(el, "clientWidth", { value: 200, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: 100, configurable: true });
  document.body.appendChild(el);
}

describe("confetti effect", () => {
  it("appends a container with `count` piece children", () => {
    const target = document.createElement("div");
    attach(target);
    const clock = makeManualClock();
    const cleanup = play(target, clock, 7);
    const container = target.querySelector('[data-effect="confetti"]');
    expect(container).not.toBeNull();
    expect(container!.querySelectorAll("[data-confetti-piece]").length).toBe(7);
    cleanup();
    document.body.removeChild(target);
  });

  it("container is removed after cleanup", () => {
    const target = document.createElement("div");
    attach(target);
    const clock = makeManualClock();
    const cleanup = play(target, clock, 4);
    expect(target.querySelector('[data-effect="confetti"]')).not.toBeNull();
    cleanup();
    expect(target.querySelector('[data-effect="confetti"]')).toBeNull();
    document.body.removeChild(target);
  });

  it("rAF ticks move pieces — transform changes over time", () => {
    const target = document.createElement("div");
    attach(target);
    const clock = makeManualClock();
    const cleanup = play(target, clock, 3);

    // Grab a piece + its initial transform.
    const piece = target.querySelector<HTMLDivElement>("[data-confetti-piece]");
    expect(piece).not.toBeNull();
    const initial = piece!.style.transform;

    // First tick seeds the "prev" timestamp without integrating.
    clock.tick(16);
    // Second tick integrates a 16ms dt against 900 px/s^2 gravity, so the
    // transform string is guaranteed to change.
    clock.tick(16);

    const after = piece!.style.transform;
    expect(after).not.toBe(initial);
    cleanup();
    document.body.removeChild(target);
  });

  it("pieces with expired lifetime are removed mid-run", () => {
    const target = document.createElement("div");
    attach(target);
    const clock = makeManualClock();
    // durationMs is 1000 — advance well past it.
    const cleanup = play(target, clock, 5);
    expect(target.querySelectorAll("[data-confetti-piece]").length).toBe(5);
    // Several frames — tick once to seed prev, then a frame that pushes
    // elapsed past 1000ms.
    clock.tick(16);
    clock.tick(2000);
    expect(target.querySelectorAll("[data-confetti-piece]").length).toBe(0);
    cleanup();
    document.body.removeChild(target);
  });

  it("reduced motion returns a no-op cleanup and doesn't render a container", () => {
    const originalMM = globalThis.matchMedia;
    (globalThis as { matchMedia?: unknown }).matchMedia = (() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof globalThis.matchMedia;
    try {
      const target = document.createElement("div");
      attach(target);
      const player = effects.get("confetti");
      const cleanup = player!(
        target,
        { id: "t", type: "confetti", count: 10, durationMs: 1000 },
        { respectReducedMotion: true },
      );
      expect(target.querySelector('[data-effect="confetti"]')).toBeNull();
      cleanup();
      document.body.removeChild(target);
    } finally {
      globalThis.matchMedia = originalMM;
    }
    // Prevent unused vi import complaints — we actually use vi elsewhere.
    void vi;
  });
});
