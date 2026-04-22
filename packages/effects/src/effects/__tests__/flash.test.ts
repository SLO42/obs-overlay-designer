import { describe, expect, it } from "vitest";
import "../../index";
import { effects } from "../../registry";

function play(target: HTMLElement, opts?: { color?: string }) {
  const player = effects.get("flash");
  if (!player) throw new Error("flash player not registered");
  return player(target, {
    id: "t",
    type: "flash",
    color: opts?.color ?? "#ff6b8a",
    durationMs: 400,
  });
}

describe("flash effect", () => {
  it("appends an overlay child during play", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const cleanup = play(target);
    const child = target.querySelector('[data-effect="flash"]');
    expect(child).not.toBeNull();
    cleanup();
    document.body.removeChild(target);
  });

  it("child is removed after cleanup", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const cleanup = play(target);
    expect(target.querySelector('[data-effect="flash"]')).not.toBeNull();
    cleanup();
    expect(target.querySelector('[data-effect="flash"]')).toBeNull();
    document.body.removeChild(target);
  });

  it("child has the correct background color", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const cleanup = play(target, { color: "rgb(10, 20, 30)" });
    const child = target.querySelector<HTMLDivElement>('[data-effect="flash"]');
    expect(child).not.toBeNull();
    expect(child!.style.backgroundColor).toBe("rgb(10, 20, 30)");
    cleanup();
    document.body.removeChild(target);
  });

  it("target's inline position is restored after cleanup when it was empty", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    expect(target.style.position).toBe("");
    const cleanup = play(target);
    // While playing, we bumped position to relative.
    expect(target.style.position).toBe("relative");
    cleanup();
    expect(target.style.position).toBe("");
    document.body.removeChild(target);
  });

  it("target's inline position is restored when it was explicitly set", () => {
    const target = document.createElement("div");
    target.style.position = "absolute";
    document.body.appendChild(target);
    const cleanup = play(target);
    // Already positioned — we should NOT touch it. But our heuristic bumps
    // only when computed position is "static" or "". Since happy-dom's
    // getComputedStyle returns "" for inline-only, verify the end-state.
    cleanup();
    expect(target.style.position).toBe("absolute");
    document.body.removeChild(target);
  });

  it("concurrent flashes stack — each call owns its own overlay", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const a = play(target);
    const b = play(target);
    expect(target.querySelectorAll('[data-effect="flash"]').length).toBe(2);
    a();
    expect(target.querySelectorAll('[data-effect="flash"]').length).toBe(1);
    b();
    expect(target.querySelectorAll('[data-effect="flash"]').length).toBe(0);
    document.body.removeChild(target);
  });
});
