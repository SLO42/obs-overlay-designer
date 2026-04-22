import { z } from "zod";

/** `#rrggbb`. */
const HEX_RGB = /^#[0-9a-fA-F]{6}$/;
/** `#rrggbb` or `#rrggbbaa`. */
const HEX_RGB_OR_RGBA = /^#[0-9a-fA-F]{8}$|^#[0-9a-fA-F]{6}$/;

/**
 * Optional media bundle — image and audio played with the alert. An empty
 * string is the "no media" sentinel because zod's URL validator is too
 * strict to accept "" natively; we explicitly OR in the empty string so
 * the inspector can clear the field without switching types.
 */
const mediaSchema = z.object({
  imageUrl: z.string().url().or(z.literal("")).default(""),
  audioUrl: z.string().url().or(z.literal("")).default(""),
  audioVolume: z.number().min(0).max(1).default(0.8),
});

export type AlertMedia = z.infer<typeof mediaSchema>;

/**
 * Single-alert-type template — one of these per event kind. Carries the
 * user-facing copy (title / subtitle with `{placeholder}` interpolation),
 * a visual accent, a per-event minimum threshold (ignored for events that
 * don't gate on magnitude, like follow), and optional media.
 */
function eventTemplate(defaults: { title: string; subtitle: string; accent: string }) {
  return z
    .object({
      enabled: z.boolean().default(true),
      title: z.string().max(160).default(defaults.title),
      subtitle: z.string().max(240).default(defaults.subtitle),
      accent: z.string().regex(HEX_RGB).default(defaults.accent),
      /**
       * Per-event minimum magnitude gate:
       *  - cheer  → bits >= threshold
       *  - raid   → viewers >= threshold
       *  - subGift → count >= threshold (count is always 1 until bulk-gift
       *              carries a real total; see templates.ts for details)
       *  - donation → amount >= threshold
       *  - everything else ignores this field entirely
       */
      threshold: z.number().int().min(0).default(0),
      media: mediaSchema.default({}),
    })
    .default({});
}

export type EventTemplate = z.infer<ReturnType<typeof eventTemplate>>;

/**
 * AlertBox widget schema. Owns six per-event templates plus a shared
 * queue/motion/visual block. Every field has `.default(...)` so the
 * inspector's auto-form can be populated from `alertBoxSchema.parse({})`.
 */
export const alertBoxSchema = z.object({
  follow: eventTemplate({
    title: "New follower!",
    subtitle: "{user}",
    accent: "#4ade80",
  }),
  subscribe: eventTemplate({
    title: "New subscriber!",
    subtitle: "{user} subscribed at Tier {tierLabel}",
    accent: "#a78bfa",
  }),
  subGift: eventTemplate({
    title: "Gift sub!",
    subtitle: "{user} gifted {count} sub{countPlural}",
    accent: "#a78bfa",
  }),
  cheer: eventTemplate({
    title: "{bits} bits!",
    subtitle: "{user} · {message}",
    accent: "#f5b95a",
  }),
  raid: eventTemplate({
    title: "Raid from {from}!",
    subtitle: "{viewers} incoming",
    accent: "#ff6b8a",
  }),
  donation: eventTemplate({
    title: "{amount} {currency}!",
    subtitle: "{user} · {message}",
    accent: "#4da3ff",
  }),

  // Queue & motion ---------------------------------------------------------
  /** How long each alert is on screen before it exits. */
  displayMs: z.number().int().min(500).max(30_000).default(5_000),
  /** Gap between consecutive alerts in the queue. */
  spacingMs: z.number().int().min(0).max(5_000).default(300),
  /** Window in which consecutive events from the same user collapse into one alert. */
  coalesceWindowMs: z.number().int().min(0).max(5_000).default(750),
  /** Hard cap on queue depth. Oldest items drop when we overflow. */
  maxQueue: z.number().int().min(1).max(100).default(25),
  entranceAnim: z.enum(["slide-up", "slide-in", "scale", "fade"]).default("slide-up"),
  exitAnim: z.enum(["slide-down", "slide-out", "scale", "fade"]).default("fade"),

  // Visuals ----------------------------------------------------------------
  fontFamily: z.enum(["sans", "display", "mono"]).default("display"),
  titleSize: z.number().int().min(18).max(96).default(36),
  subtitleSize: z.number().int().min(10).max(48).default(18),
  /** Shows the little Lucide icon on the left of the card. */
  showBadge: z.boolean().default(true),
  cardPadding: z.number().int().min(4).max(48).default(16),
  cardRadius: z.number().int().min(0).max(32).default(10),
  /** Accepts #rrggbb or #rrggbbaa so users can dial in translucent cards. */
  cardBg: z.string().regex(HEX_RGB_OR_RGBA).default("#11141bcc"),
  textShadow: z.boolean().default(true),
});

export type AlertBoxProps = z.infer<typeof alertBoxSchema>;
