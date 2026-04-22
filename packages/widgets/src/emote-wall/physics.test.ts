import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawnParticle, stepParticle, type Particle, type World } from "./physics";

function makeWorld(over: Partial<World> = {}): World {
  return {
    width: 800,
    height: 600,
    gravity: 1000,
    bounce: 0.5,
    floatRiseSpeed: 100,
    floatWobbleAmp: 20,
    floatWobbleFreq: 1,
    ...over,
  };
}

function baseSpawn(over: Partial<Parameters<typeof spawnParticle>[0]> = {}) {
  return spawnParticle({
    id: over.id ?? "p1",
    src: over.src ?? "https://example.test/e.png",
    anchor: over.anchor ?? { x: 100, y: 100 },
    jitter: over.jitter ?? 0,
    size: over.size ?? 40,
    mode: over.mode ?? "drop",
    now: over.now ?? 1_000,
    lifetimeMs: over.lifetimeMs ?? 6_000,
    rotationEnabled: over.rotationEnabled ?? true,
    rotationSpeedMax: over.rotationSpeedMax ?? 360,
    initialVelocityMin: over.initialVelocityMin ?? 120,
    initialVelocityMax: over.initialVelocityMax ?? 320,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(1_000));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("spawnParticle", () => {
  it("drop: vx and vy are zero at spawn", () => {
    const p = baseSpawn({ mode: "drop" });
    expect(p.vx).toBe(0);
    expect(p.vy).toBe(0);
    expect(p.mode).toBe("drop");
  });

  it("drop: position lands inside [anchor - jitter, anchor + jitter] for both axes", () => {
    for (let i = 0; i < 32; i += 1) {
      const p = baseSpawn({ mode: "drop", anchor: { x: 200, y: 300 }, jitter: 40 });
      expect(p.x).toBeGreaterThanOrEqual(160);
      expect(p.x).toBeLessThanOrEqual(240);
      expect(p.y).toBeGreaterThanOrEqual(260);
      expect(p.y).toBeLessThanOrEqual(340);
    }
  });

  it("burst: initial speed magnitude falls within [min, max]", () => {
    for (let i = 0; i < 64; i += 1) {
      const p = baseSpawn({
        mode: "burst",
        initialVelocityMin: 150,
        initialVelocityMax: 300,
      });
      const speed = Math.hypot(p.vx, p.vy);
      expect(speed).toBeGreaterThanOrEqual(149.9);
      expect(speed).toBeLessThanOrEqual(300.1);
    }
  });

  it("burst: direction is isotropic (at least two distinct hemispheres across 32 spawns)", () => {
    const signs = new Set<string>();
    for (let i = 0; i < 32; i += 1) {
      const p = baseSpawn({ mode: "burst" });
      signs.add(`${Math.sign(p.vx)}:${Math.sign(p.vy)}`);
    }
    // With 32 samples over a uniform angle we should easily cover multiple
    // hemispheres (at least three of the four sign combinations).
    expect(signs.size).toBeGreaterThanOrEqual(3);
  });

  it("float: vx is zero and vy is negative (upward hint) at spawn", () => {
    const p = baseSpawn({ mode: "float" });
    expect(p.vx).toBe(0);
    expect(p.vy).toBeLessThan(0);
  });

  it("rotation disabled forces rotSpeed to 0", () => {
    const p = baseSpawn({ rotationEnabled: false, rotationSpeedMax: 360 });
    expect(p.rotSpeed).toBe(0);
  });
});

describe("stepParticle — drop (semi-implicit Euler)", () => {
  it("applies vy += gravity * dt then y += vy * dt", () => {
    const p: Particle = {
      ...baseSpawn({ mode: "drop", anchor: { x: 100, y: 100 } }),
      vy: 0,
      vx: 0,
    };
    const world = makeWorld({ gravity: 1000 });
    const dtMs = 100; // 0.1s
    const stepped = stepParticle(p, dtMs, world)!;
    expect(stepped.vy).toBeCloseTo(100, 5); // 0 + 1000 * 0.1
    // Semi-implicit: new y = old y + new vy * dt = 100 + 100 * 0.1 = 110
    expect(stepped.y).toBeCloseTo(110, 5);
  });

  it("bounces off the floor with the given coefficient of restitution", () => {
    // Start just above the floor with a downward velocity so one step
    // punches through.
    const p: Particle = {
      ...baseSpawn({ mode: "drop", anchor: { x: 100, y: 540 } }),
      vy: 500, // fast enough to clip the floor in 100ms
      vx: 0,
      rot: 0,
      rotSpeed: 0,
    };
    const world = makeWorld({ gravity: 0, bounce: 0.5 });
    const stepped = stepParticle(p, 100, world)!;
    // Floor sits at `height - size` = 600 - 40 = 560.
    expect(stepped.y).toBeLessThanOrEqual(560);
    // Bounce: vy = -(500) * 0.5 = -250 (upward).
    expect(stepped.vy).toBeCloseTo(-250, 5);
  });
});

describe("stepParticle — float", () => {
  it("exits the top when y + size < 0 and returns null", () => {
    const p: Particle = {
      ...baseSpawn({ mode: "float", anchor: { x: 100, y: 0 }, size: 40 }),
      y: -50,
    };
    const world = makeWorld();
    expect(stepParticle(p, 16, world)).toBeNull();
  });

  it("remains (non-null) while inside the box", () => {
    const p: Particle = {
      ...baseSpawn({ mode: "float", anchor: { x: 100, y: 300 }, size: 40 }),
    };
    const world = makeWorld();
    const stepped = stepParticle(p, 16, world);
    expect(stepped).not.toBeNull();
    expect(stepped!.y).toBeLessThan(300); // moved up
  });
});

describe("stepParticle — burst", () => {
  it("exits the 2x margin region and returns null", () => {
    const world = makeWorld({ gravity: 0 });
    const p: Particle = {
      ...baseSpawn({ mode: "burst", anchor: { x: 100, y: 100 }, size: 40 }),
      x: -200, // well outside the 2*size = 80px margin
      y: -200,
      vx: 0,
      vy: 0,
    };
    expect(stepParticle(p, 16, world)).toBeNull();
  });
});

describe("stepParticle — rotation + lifetime", () => {
  it("rot accumulates by rotSpeed * dt", () => {
    const p: Particle = {
      ...baseSpawn({ mode: "drop" }),
      vy: 0,
      vx: 0,
      rot: 10,
      rotSpeed: 180, // deg/s
    };
    const world = makeWorld({ gravity: 0 });
    const stepped = stepParticle(p, 100, world)!;
    // 180 deg/s * 0.1s = 18 deg, + starting 10 deg = 28 deg.
    expect(stepped.rot).toBeCloseTo(28, 5);
  });

  it("age > lifetimeMs returns null", () => {
    const p = baseSpawn({ mode: "drop", lifetimeMs: 500, now: 1_000 });
    // Advance real clock well past lifetime + 1 from the fake-timer baseline.
    vi.setSystemTime(new Date(1_000 + 600));
    expect(stepParticle(p, 16, makeWorld())).toBeNull();
  });
});
