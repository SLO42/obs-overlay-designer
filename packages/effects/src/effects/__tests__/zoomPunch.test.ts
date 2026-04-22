import { describe, expect, it, vi } from "vitest";
import "../../index";
import { effects } from "../../registry";

function play(target: HTMLElement, opts?: { respectReducedMotion?: boolean }) {
  const player = effects.get("zoom-punch");
  if (!player) throw new Error("zoom-punch player not registered");
  return player(target, { id: "t", type: "zoom-punch", scale: 1.2, durationMs: 400 }, opts);
}

describe("zoom-punch effect", () => {
  it("runs an animation on the target", () => {
    const target = document.createElement("div");
    const cleanup = play(target);
    const anims = (target as unknown as { getAnimations(): Array<unknown> }).getAnimations();
    expect(anims.length).toBe(1);
    cleanup();
  });

  it("restores transform-origin on cleanup", () => {
    const target = document.createElement("div");
    // Pre-existing inline origin should be preserved across the effect.
    target.style.transformOrigin = "top left";
    const cleanup = play(target);
    expect(target.style.transformOrigin).toBe("center center");
    cleanup();
    expect(target.style.transformOrigin).toBe("top left");
  });

  it("removes inline transform-origin when it was unset originally", () => {
    const target = document.createElement("div");
    const cleanup = play(target);
    expect(target.style.transformOrigin).toBe("center center");
    cleanup();
    expect(target.style.transformOrigin).toBe("");
  });

  it("cleanup cancels mid-flight and is idempotent", () => {
    const target = document.createElement("div");
    const cleanup = play(target);
    const anim = (
      target as unknown as { getAnimations(): Array<{ cancel: () => void }> }
    ).getAnimations()[0];
    const spy = vi.spyOn(anim!, "cancel");
    cleanup();
    cleanup();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("respectReducedMotion is a no-op: no animation runs", () => {
    const originalMM = globalThis.matchMedia;
    (globalThis as { matchMedia?: unknown }).matchMedia = (() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof globalThis.matchMedia;
    try {
      const target = document.createElement("div");
      const cleanup = play(target, { respectReducedMotion: true });
      const anims = (target as unknown as { getAnimations(): unknown[] }).getAnimations();
      expect(anims.length).toBe(0);
      cleanup();
    } finally {
      globalThis.matchMedia = originalMM;
    }
  });
});
