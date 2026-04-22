import { z } from "zod";

/** `#rrggbb`. */
const HEX_RGB = /^#[0-9a-fA-F]{6}$/;
/** `#rrggbb` or `#rrggbbaa`. */
const HEX_RGB_OR_RGBA = /^#[0-9a-fA-F]{8}$|^#[0-9a-fA-F]{6}$/;

/**
 * EventTicker widget schema.
 *
 * Renders a horizontal marquee of recent stream events — follows, subs,
 * cheers, raids, donations, redemptions, and (optionally) chat — scrolling
 * seamlessly through the widget box at a runtime-tunable pixel-per-second
 * rate. Each event kind can be toggled on/off independently, matching the
 * AlertBox pattern of giving users full control over the celebration mix.
 *
 * Every field carries a `.default(...)` so the builder's inspector auto-form
 * can populate itself from `eventTickerSchema.parse({})`. Ranges are
 * deliberately forgiving — the ticker is a constantly-running layout so the
 * user is more likely to tune speed / gap than to worry about overflow.
 */
export const eventTickerSchema = z.object({
  // Which event kinds to include ------------------------------------------
  includeFollow: z.boolean().default(true),
  includeSubscribe: z.boolean().default(true),
  includeSubGift: z.boolean().default(true),
  includeCheer: z.boolean().default(true),
  includeRaid: z.boolean().default(true),
  includeRedeem: z.boolean().default(false),
  includeDonation: z.boolean().default(true),
  /** Off by default — chat would quickly flood the ticker. */
  includeChat: z.boolean().default(false),

  // Motion ----------------------------------------------------------------
  /** Scroll speed in CSS px per second. Driven by an rAF loop, not a CSS keyframe. */
  pixelsPerSecond: z.number().int().min(10).max(400).default(60),
  /** Horizontal scroll direction. */
  direction: z.enum(["left", "right"]).default("left"),
  /**
   * If no new event arrives for this long, the marquee pauses (saves motion
   * budget + lets the viewer notice the last event). A fresh event resumes it.
   */
  restAfterMs: z.number().int().min(0).max(120_000).default(15_000),
  /** Gap in px between adjacent entry pills inside the track. */
  gapPx: z.number().int().min(0).max(200).default(48),

  // Capacity / lifecycle ---------------------------------------------------
  /** Hard cap on entries in the track. Oldest drop first. */
  maxEntries: z.number().int().min(1).max(200).default(40),
  /** Entries older than this drop from the track regardless of `maxEntries`. */
  entryLifetimeMs: z.number().int().min(1_000).max(600_000).default(120_000),

  /**
   * Back-to-back same-user events fold together inside this window. Cheers
   * sum bits, subGifts increment the count, donations sum amount (when the
   * currency matches). Other kinds never coalesce.
   */
  coalesceWindowMs: z.number().int().min(0).max(10_000).default(1_500),

  // Visual ----------------------------------------------------------------
  fontFamily: z.enum(["sans", "display", "mono"]).default("sans"),
  fontSize: z.number().int().min(10).max(48).default(16),
  padY: z.number().int().min(0).max(48).default(6),
  padX: z.number().int().min(0).max(48).default(10),
  gap: z.number().int().min(0).max(24).default(6),
  borderRadius: z.number().int().min(0).max(32).default(6),
  /** Accepts #rrggbb or #rrggbbaa so users can dial in translucent pills. */
  bg: z.string().regex(HEX_RGB_OR_RGBA).default("#11141bcc"),
  /** #rrggbb — text color is opaque; users can tone it via the pill bg alpha. */
  textColor: z.string().regex(HEX_RGB).default("#e6e8ef"),
  /** Per-entry Lucide icon (kind-specific) toggled globally. */
  showIcons: z.boolean().default(true),
  /** Relative time tag like "2m" appended to each entry. */
  showTimestamps: z.boolean().default(false),
  textShadow: z.boolean().default(true),
});

export type EventTickerProps = z.infer<typeof eventTickerSchema>;
