/**
 * Pure physics module for the EmoteWall widget. No DOM, no React, no rAF —
 * just the particle state type plus `spawnParticle` + `stepParticle`. This
 * lets the Runtime drive the simulation with a single rAF loop while the
 * simulation itself stays easy to unit-test.
 *
 * Integration scheme: semi-implicit (symplectic) Euler.
 *
 *     vy += gravity * dt
 *     y  += vy      * dt
 *
 * This is cheaper than midpoint / RK4 and stable enough for the speeds +
 * timesteps we see in practice (rAF ≈ 16ms, vy capped by the "sane" ranges
 * in the schema). The tests assert the semi-implicit form exactly.
 */

export type EmoteWallMode = "drop" | "float" | "burst";

/**
 * A single animated emote. All coordinates are in widget-local px, origin at
 * the top-left of the widget box. `bornAt` is the epoch ms at spawn so the
 * age check + fade-out computation in the Runtime can reuse `Date.now()`.
 */
export interface Particle {
  id: string;
  /** Image URL — typically a Twitch emote CDN link. */
  src: string;
  x: number;
  y: number;
  /** px/s. */
  vx: number;
  vy: number;
  /** Current rotation in degrees. */
  rot: number;
  /** deg/s. Positive = clockwise. */
  rotSpeed: number;
  /** Square size in px (width = height). */
  size: number;
  /** Epoch ms at which the particle was spawned. */
  bornAt: number;
  /** ms before removal regardless of physics state. */
  lifetimeMs: number;
  /** Physics mode at spawn time. Never changes mid-life. */
  mode: EmoteWallMode;
}

/**
 * Describes the simulation box + global physics constants. Constructed once
 * per rAF frame by the Runtime and passed through to `stepParticle`.
 */
export interface World {
  /** Widget box width in px (clips particles on the right). */
  width: number;
  /** Widget box height in px (clips particles on the bottom). */
  height: number;
  /** px/s^2. Applied to drop + burst; float ignores. */
  gravity: number;
  /** Coefficient of restitution on floor/walls (0..1). */
  bounce: number;
  /** Baseline upward speed for float mode in px/s. */
  floatRiseSpeed: number;
  /** Float mode sine amplitude in px. */
  floatWobbleAmp: number;
  /** Float mode sine frequency in Hz. */
  floatWobbleFreq: number;
}

export interface SpawnOptions {
  id: string;
  src: string;
  anchor: { x: number; y: number };
  /** Uniform offset in ±jitter (px) applied to x + y independently. */
  jitter: number;
  size: number;
  mode: EmoteWallMode;
  /** Epoch ms. */
  now: number;
  lifetimeMs: number;
  /** When false, `rotSpeed` is forced to 0 at spawn. */
  rotationEnabled: boolean;
  /** Max absolute spin rate — actual is uniform in ±this value. */
  rotationSpeedMax: number;
  /** Burst mode only: speed range. */
  initialVelocityMin: number;
  initialVelocityMax: number;
}

/** Uniform real number in `[min, max]`. */
function uniform(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Construct a fresh particle. Position is `anchor + uniform(±jitter)` per
 * axis; initial velocity varies by mode:
 *  - `drop`  — rest (0, 0).
 *  - `float` — (0, -floatRiseSpeed) *not* applied here; float uses a static
 *              vy managed by `stepParticle` instead. We still bake `-1` into
 *              `vy` as a hint so tests can observe the upward bias.
 *  - `burst` — random 2D unit vector scaled by a uniform speed.
 *
 * Note on float mode: the sine wobble is position-based (not velocity-based)
 * so `stepParticle` recomputes x every frame from `bornAt`. `vx` stays at 0
 * and `vy` stays at `-floatRiseSpeed` across the particle's life.
 *
 * Note on rotation: `rotSpeed` is picked uniformly in `[-rotationSpeedMax,
 * +rotationSpeedMax]` so the wall feels organic. Disabling rotation forces
 * it to 0.
 */
export function spawnParticle(opts: SpawnOptions): Particle {
  const jx = opts.jitter > 0 ? uniform(-opts.jitter, opts.jitter) : 0;
  const jy = opts.jitter > 0 ? uniform(-opts.jitter, opts.jitter) : 0;

  let vx = 0;
  let vy = 0;
  if (opts.mode === "burst") {
    const angle = Math.random() * Math.PI * 2;
    const speed = uniform(opts.initialVelocityMin, opts.initialVelocityMax);
    vx = Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;
  } else if (opts.mode === "float") {
    // vy is re-derived in stepParticle; we store a negative hint for tests
    // + so any first-frame render doesn't accidentally sit still.
    vy = -1;
  }

  const rotSpeed =
    opts.rotationEnabled && opts.rotationSpeedMax > 0
      ? uniform(-opts.rotationSpeedMax, opts.rotationSpeedMax)
      : 0;

  return {
    id: opts.id,
    src: opts.src,
    x: opts.anchor.x + jx,
    y: opts.anchor.y + jy,
    vx,
    vy,
    rot: 0,
    rotSpeed,
    size: opts.size,
    bornAt: opts.now,
    lifetimeMs: opts.lifetimeMs,
    mode: opts.mode,
  };
}

/**
 * Advance one particle by `dtMs` and return the updated copy, or `null` if
 * the particle should be removed from the scene. Removal cases:
 *  - age > `lifetimeMs` for every mode
 *  - `float`: y falls below `-size` (exited the top) or above
 *    `height + size` (exited the bottom — shouldn't happen but covers
 *    config edge cases)
 *  - `burst`: fully outside the box + 2× margin (fireworks done)
 *  - `drop`: only the age check — drop particles dwell inside the box
 *    bouncing on the floor and fade out via the lifetime timer.
 *
 * Age is read from `Date.now() - p.bornAt`. That makes `stepParticle`
 * impure w.r.t. the wall clock, but it mirrors the Runtime's semantics and
 * tests can steer it via `vi.setSystemTime`.
 */
export function stepParticle(p: Particle, dtMs: number, world: World): Particle | null {
  const dt = dtMs / 1000;
  const age = Date.now() - p.bornAt;
  if (age > p.lifetimeMs) return null;

  let { x, y, vx, vy } = p;
  const { size } = p;

  if (p.mode === "float") {
    // Position-driven sine wobble. Position uses age-based phase so the
    // wobble is independent of the frame rate.
    const phase = (age / 1000) * world.floatWobbleFreq * Math.PI * 2;
    // Integrate a baseline vertical velocity; x is a pure sine offset
    // relative to the spawn point. We *store* the wobble offset into x
    // by integrating a velocity computed from the sine's derivative so
    // stepParticle remains a proper integrator.
    //
    // Cheaper alternative: treat x as the spawn-point (we don't track
    // it separately) and just move it by the sine's delta. Since we
    // don't have the spawn-point stashed, we use the derivative form:
    //   dx/dt = amp * freq * 2π * cos(phase)
    // The constant factor here stays the same across frames so drift is
    // bounded.
    const wobbleDerivative =
      world.floatWobbleAmp * world.floatWobbleFreq * Math.PI * 2 * Math.cos(phase);
    vx = wobbleDerivative;
    vy = -world.floatRiseSpeed;
    x += vx * dt;
    y += vy * dt;

    // Out the top?
    if (y + size < 0) return null;
    // Safety: out the bottom (only if floatRiseSpeed is negative).
    if (y > world.height + size) return null;
  } else {
    // drop / burst: semi-implicit Euler.
    vy += world.gravity * dt;
    x += vx * dt;
    y += vy * dt;

    // Wall bounces (left + right) for drop + burst.
    if (x < 0) {
      x = 0;
      vx = -vx * world.bounce;
    } else if (x + size > world.width) {
      x = world.width - size;
      vx = -vx * world.bounce;
    }

    if (p.mode === "drop") {
      // Floor bounce. Horizontal velocity is dampened by the same
      // coefficient so the particle eventually settles.
      if (y + size > world.height) {
        y = world.height - size;
        vy = -vy * world.bounce;
        vx *= world.bounce;
      }
    } else {
      // Burst: remove once fully outside a 2× margin around the box.
      const margin = size * 2;
      if (
        x + size < -margin ||
        x > world.width + margin ||
        y + size < -margin ||
        y > world.height + margin
      ) {
        return null;
      }
    }
  }

  const rot = p.rot + p.rotSpeed * dt;

  return {
    ...p,
    x,
    y,
    vx,
    vy,
    rot,
  };
}
