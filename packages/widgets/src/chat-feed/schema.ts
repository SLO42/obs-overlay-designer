import { z } from "zod";

/** `#rrggbb`. */
const HEX_RGB = /^#[0-9a-fA-F]{6}$/;
/** `#rrggbb` or `#rrggbbaa`. */
const HEX_RGB_OR_RGBA = /^#[0-9a-fA-F]{8}$|^#[0-9a-fA-F]{6}$/;

/**
 * ChatFeed widget schema.
 *
 * Every field carries a `.default(...)` so the builder's Inspector auto-form
 * produces a complete control set from `chatFeedSchema.parse({})`. Ranges
 * are deliberately conservative (e.g. `maxMessages <= 200`) to keep the
 * widget from becoming a layout-thrashing monster in a burst.
 *
 * `showPronouns` is wired up now for UI symmetry with future pronoun
 * lookups (Alejo/pronouns.alejo.io / StreamElements). We don't render
 * pronouns yet — the toggle is a no-op at runtime but the schema key is
 * stable so adding rendering later doesn't break existing saves.
 */
export const chatFeedSchema = z.object({
  fontSize: z.number().int().min(10).max(48).default(16),
  fontFamily: z.enum(["sans", "mono"]).default("sans"),
  density: z.enum(["compact", "cozy", "comfortable"]).default("cozy"),
  showBadges: z.boolean().default(true),
  showTimestamps: z.boolean().default(false),
  showPronouns: z.boolean().default(false),
  maxMessages: z.number().int().min(1).max(200).default(50),
  /** 0 disables fade-out entirely. */
  fadeAfterMs: z.number().int().min(0).max(60_000).default(0),
  fadeDurationMs: z.number().int().min(0).max(5_000).default(500),
  entranceAnim: z.enum(["none", "fade", "slide-up"]).default("slide-up"),
  lineColor: z.string().regex(HEX_RGB_OR_RGBA).default("#ffffff"),
  mentionColor: z.string().regex(HEX_RGB).default("#8b5cf6"),
  backgroundColor: z.string().regex(HEX_RGB_OR_RGBA).default("#00000000"),
  padding: z.number().int().min(0).max(48).default(8),
  borderRadius: z.number().int().min(0).max(32).default(6),
  textShadow: z.boolean().default(true),
  /** true stacks newest at the bottom (chat-app default); false stacks newest at top. */
  alignBottom: z.boolean().default(true),
});

export type ChatFeedProps = z.infer<typeof chatFeedSchema>;
