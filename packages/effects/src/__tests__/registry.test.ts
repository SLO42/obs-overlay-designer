import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Importing the barrel runs the side-effect registrations, so every default
// player is already installed by the time these tests execute.
import { effects, playEffect } from "../index";

describe("effects registry + playEffect", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  it("playEffect with an unknown type returns a no-op and warns", () => {
    const target = document.createElement("div");
    // @ts-expect-error — intentional: we're probing the unknown-type path.
    const cleanup = playEffect(target, { id: "x", type: "not-real", durationMs: 100 });
    expect(typeof cleanup).toBe("function");
    cleanup();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no player registered"));
  });

  it("re-registering an existing type warns", () => {
    effects.register("shake", () => () => {});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("re-registering"));
  });

  it("effects.get returns each of the five built-in players", () => {
    for (const type of ["shake", "flash", "zoom-punch", "confetti", "emote-rain"] as const) {
      const player = effects.get(type);
      expect(player, `missing player for ${type}`).toBeTypeOf("function");
    }
  });

  it("playEffect invokes the registered player with the right args", () => {
    const spy = vi.fn((_target: HTMLElement, _effect: unknown) => () => {}) as ReturnType<
      typeof vi.fn
    >;
    effects.register("shake", spy as never);
    const target = document.createElement("div");
    const effect = { id: "e1", type: "shake" as const, amplitude: 4, durationMs: 200 };
    playEffect(target, effect);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe(target);
    expect(spy.mock.calls[0]?.[1]).toEqual(effect);
  });

  it("cleanup is idempotent — calling it twice is safe", () => {
    const inner = vi.fn();
    effects.register("shake", () => inner);
    const target = document.createElement("div");
    const cleanup = playEffect(target, {
      id: "e2",
      type: "shake",
      amplitude: 4,
      durationMs: 200,
    });
    cleanup();
    cleanup();
    cleanup();
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("player throwing is caught — playEffect returns a no-op and logs", () => {
    effects.register("shake", () => {
      throw new Error("boom");
    });
    const target = document.createElement("div");
    const cleanup = playEffect(target, {
      id: "e3",
      type: "shake",
      amplitude: 4,
      durationMs: 200,
    });
    expect(typeof cleanup).toBe("function");
    expect(() => cleanup()).not.toThrow();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(`[effects] player for "shake" threw`),
      expect.anything(),
    );
  });

  it("effects.all() returns a snapshot map, not the live registry", () => {
    const snapshot = effects.all();
    expect(snapshot).toBeInstanceOf(Map);
    expect(snapshot.size).toBeGreaterThanOrEqual(5);
    // Mutating the snapshot should not affect the live registry.
    snapshot.clear();
    expect(effects.get("shake")).toBeTypeOf("function");
  });
});
