import { z } from "zod";

/** `#rrggbb` or `#rrggbbaa`. */
const HEX_RGB_OR_RGBA = /^#[0-9a-fA-F]{8}$|^#[0-9a-fA-F]{6}$/;

/**
 * EmoteWall widget schema.
 *
 * Collects emote + cheermote fragments from `chat.message` events and spawns
 * flying particles inside the widget box. Three physics modes:
 * - `drop`   — particles start at rest and fall under gravity, bouncing off
 *              the floor with a user-tunable coefficient of restitution.
 * - `float`  — particles rise slowly with a sinusoidal wobble, exiting the
 *              top of the box. Gravity is ignored.
 * - `burst`  — particles spawn in a random 2D direction with a uniform
 *              speed in `[initialVelocityMin, initialVelocityMax]`. Gravity
 *              still applies (usually configured to 0 for pure fireworks).
 *
 * Every field carries a `.default(...)` so the builder's inspector auto-form
 * can populate itself from `emoteWallSchema.parse({})`. Ranges are sized for
 * the builder's 1920x1080 canvas — `maxParticles: 500` is a hard cap that
 * protects the DOM render path from an emote flood.
 */
export const emoteWallSchema = z.object({
  // Collection ------------------------------------------------------------
  /**
   * Dedup window. If the same emote fires again within this window the
   * particle still spawns — this is here for future throttling knobs; today
   * it only affects how "recent" an emote feels for debug/inspection.
   */
  collectionWindowMs: z.number().int().min(0).max(30_000).default(1_200),
  /** Hard cap on live particles. Oldest drop when exceeded. */
  maxParticles: z.number().int().min(1).max(500).default(80),
  /** Per-emote spawn count — let one `:kappa:` fire three particles. */
  spawnPerEmote: z.number().int().min(1).max(10).default(1),

  // Physics mode ----------------------------------------------------------
  mode: z.enum(["drop", "float", "burst"]).default("drop"),
  /** px/s^2. Drop/burst apply; float ignores. Negative = "up". */
  gravity: z.number().min(-2000).max(2000).default(900),
  /** Coefficient of restitution on floor/walls (0..1). */
  bounce: z.number().min(0).max(1).default(0.4),
  /** Burst mode: initial speed range in px/s. */
  initialVelocityMin: z.number().min(0).max(2000).default(120),
  initialVelocityMax: z.number().min(0).max(2000).default(320),
  /** Float mode: baseline upward speed in px/s. */
  floatRiseSpeed: z.number().min(0).max(1000).default(90),
  /** Float mode: sine wobble amplitude in px. */
  floatWobbleAmp: z.number().min(0).max(200).default(24),
  /** Float mode: sine freq in Hz. */
  floatWobbleFreq: z.number().min(0).max(10).default(1.5),

  // Visual ----------------------------------------------------------------
  /** Square particle size in px. */
  particleSize: z.number().int().min(16).max(256).default(56),
  /** Toggle per-particle spin. */
  particleRotation: z.boolean().default(true),
  /** Max absolute spin rate in deg/s. Actual rate is picked in ±this range. */
  rotationSpeedMax: z.number().min(0).max(720).default(240),

  // Lifecycle --------------------------------------------------------------
  /** Per-particle cap in ms. */
  lifetimeMs: z.number().int().min(500).max(60_000).default(6_000),
  /** Fade duration before removal. */
  fadeOutMs: z.number().int().min(0).max(10_000).default(800),
  /** Offset added to anchor — uniform in ±jitter. */
  spawnJitterPx: z.number().int().min(0).max(500).default(60),

  // Sources ---------------------------------------------------------------
  /** Whether Twitch first-party emotes count. */
  includeFirstPartyEmotes: z.boolean().default(true),
  /** Whether cheermote fragments count. */
  includeCheermotes: z.boolean().default(true),
  /** Gate: require subscriber / vip / mod / broadcaster role. */
  onlySubscribers: z.boolean().default(false),

  // Background rendering of the widget box itself ------------------------
  /** Accepts `#rrggbb` or `#rrggbbaa` (default fully transparent). */
  bg: z.string().regex(HEX_RGB_OR_RGBA).default("#00000000"),
  borderRadius: z.number().int().min(0).max(32).default(0),
});

export type EmoteWallProps = z.infer<typeof emoteWallSchema>;
