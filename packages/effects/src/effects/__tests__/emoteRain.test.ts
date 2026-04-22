import { describe, expect, it } from "vitest";
import "../../index";
import { effects } from "../../registry";
import { FALLBACK_EMOTE_SRCS } from "../emoteRain";

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
  };
}

function attach(el: HTMLElement) {
  Object.defineProperty(el, "clientWidth", { value: 300, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: 200, configurable: true });
  document.body.appendChild(el);
}

describe("emote-rain effect", () => {
  it("spawns particles over time via mock rAF", () => {
    const target = document.createElement("div");
    attach(target);
    const clock = makeManualClock();
    const player = effects.get("emote-rain");
    const cleanup = player!(
      target,
      { id: "t", type: "emote-rain", durationMs: 2000 },
      {
        now: clock.now,
        raf: clock.raf,
        cancelRaf: clock.cancelRaf,
        emoteUrls: ["https://example.test/a.png", "https://example.test/b.png"],
      },
    );
    const container = target.querySelector<HTMLDivElement>('[data-effect="emote-rain"]');
    expect(container).not.toBeNull();
    // Seed prev.
    clock.tick(16);
    // 500ms at 8/s → expect 4 particles.
    clock.tick(500);
    const particles = container!.querySelectorAll("[data-emote-rain-particle]");
    expect(particles.length).toBeGreaterThanOrEqual(4);
    cleanup();
    document.body.removeChild(target);
  });

  it("uses ctx.emoteUrls when provided", () => {
    const target = document.createElement("div");
    attach(target);
    const clock = makeManualClock();
    const url = "https://example.test/custom-emote.png";
    const player = effects.get("emote-rain");
    const cleanup = player!(
      target,
      { id: "t", type: "emote-rain", durationMs: 1000 },
      { now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, emoteUrls: [url] },
    );
    clock.tick(16);
    clock.tick(200);
    const imgs = target.querySelectorAll<HTMLImageElement>("[data-emote-rain-particle]");
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img.src).toBe(url);
    }
    cleanup();
    document.body.removeChild(target);
  });

  it("falls back to built-in data-URIs when emoteUrls is absent", () => {
    const target = document.createElement("div");
    attach(target);
    const clock = makeManualClock();
    const player = effects.get("emote-rain");
    const cleanup = player!(
      target,
      { id: "t", type: "emote-rain", durationMs: 1000 },
      { now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf },
    );
    clock.tick(16);
    clock.tick(400);
    const imgs = target.querySelectorAll<HTMLImageElement>("[data-emote-rain-particle]");
    expect(imgs.length).toBeGreaterThan(0);
    const allowed = new Set(FALLBACK_EMOTE_SRCS);
    for (const img of imgs) {
      expect(allowed.has(img.src)).toBe(true);
    }
    cleanup();
    document.body.removeChild(target);
  });

  it("falls back when emoteUrls is empty", () => {
    const target = document.createElement("div");
    attach(target);
    const clock = makeManualClock();
    const player = effects.get("emote-rain");
    const cleanup = player!(
      target,
      { id: "t", type: "emote-rain", durationMs: 1000 },
      { now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, emoteUrls: [] },
    );
    clock.tick(16);
    clock.tick(200);
    const imgs = target.querySelectorAll<HTMLImageElement>("[data-emote-rain-particle]");
    expect(imgs.length).toBeGreaterThan(0);
    const allowed = new Set(FALLBACK_EMOTE_SRCS);
    for (const img of imgs) {
      expect(allowed.has(img.src)).toBe(true);
    }
    cleanup();
    document.body.removeChild(target);
  });

  it("cleanup removes the container", () => {
    const target = document.createElement("div");
    attach(target);
    const clock = makeManualClock();
    const player = effects.get("emote-rain");
    const cleanup = player!(
      target,
      { id: "t", type: "emote-rain", durationMs: 1000 },
      { now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf },
    );
    expect(target.querySelector('[data-effect="emote-rain"]')).not.toBeNull();
    cleanup();
    expect(target.querySelector('[data-effect="emote-rain"]')).toBeNull();
    document.body.removeChild(target);
  });
});
