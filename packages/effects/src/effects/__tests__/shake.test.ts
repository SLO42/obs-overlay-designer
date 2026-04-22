import { describe, expect, it, vi } from "vitest";
// Barrel import installs the shim + registers every player.
import "../../index";
import { effects } from "../../registry";

function play(target: HTMLElement, opts?: { respectReducedMotion?: boolean }) {
  const player = effects.get("shake");
  if (!player) throw new Error("shake player not registered");
  return player(target, { id: "t", type: "shake", amplitude: 8, durationMs: 600 }, opts);
}

describe("shake effect", () => {
  it("returns a cleanup function", () => {
    const target = document.createElement("div");
    const cleanup = play(target);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("attaches an animation with 8 keyframes", () => {
    const target = document.createElement("div");
    const cleanup = play(target);
    const anims = (
      target as unknown as { getAnimations(): Array<{ effect: { getKeyframes(): unknown[] } }> }
    ).getAnimations();
    expect(anims.length).toBe(1);
    const kf = anims[0]?.effect.getKeyframes();
    expect(kf).toHaveLength(8);
    cleanup();
  });

  it("cleanup cancels the animation and is idempotent", () => {
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

  it("reduced-motion path emits only 3 keyframes (single pulse)", () => {
    const target = document.createElement("div");
    // Force prefersReducedMotion() to report true.
    const originalMM = globalThis.matchMedia;
    (globalThis as { matchMedia?: unknown }).matchMedia = (() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof globalThis.matchMedia;
    try {
      const cleanup = play(target, { respectReducedMotion: true });
      const anims = (
        target as unknown as { getAnimations(): Array<{ effect: { getKeyframes(): unknown[] } }> }
      ).getAnimations();
      expect(anims.length).toBe(1);
      expect(anims[0]?.effect.getKeyframes()).toHaveLength(3);
      cleanup();
    } finally {
      globalThis.matchMedia = originalMM;
    }
  });
});
