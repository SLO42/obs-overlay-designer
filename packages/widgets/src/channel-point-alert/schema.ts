import { z } from "zod";

/** `#rrggbb`. */
const HEX_RGB = /^#[0-9a-fA-F]{6}$/;
/** `#rrggbb` or `#rrggbbaa`. */
const HEX_RGB_OR_RGBA = /^#[0-9a-fA-F]{8}$|^#[0-9a-fA-F]{6}$/;

/**
 * ChannelPointAlert widget schema. One widget instance celebrates a single
 * reward (identified by `rewardId`), or — with both filters blank — acts as
 * a catch-all for every custom reward redemption. The field set intentionally
 * mirrors AlertBox's queue / motion / visual block so users who've already
 * tuned one alert UI feel at home; the per-event gating AlertBox does via
 * disable/threshold maps onto `rewardId` / `rewardTitleContains` filters.
 */
export const channelPointAlertSchema = z.object({
  // Filtering ---------------------------------------------------------------
  /**
   * Exact reward ID. When non-empty this is the only filter consulted —
   * matching events are accepted, everything else is dropped. Leave blank to
   * fall through to `rewardTitleContains`.
   */
  rewardId: z.string().max(100).default(""),
  /**
   * Case-insensitive substring of the reward title. Only consulted when
   * `rewardId` is blank. Leave both blank to match every redemption.
   */
  rewardTitleContains: z.string().max(100).default(""),

  // Templates ---------------------------------------------------------------
  /** Main line. Supports `{user}`, `{displayName}`, `{login}`, `{rewardTitle}`, `{userInput}`. */
  title: z.string().max(200).default("{user} redeemed {rewardTitle}"),
  /** Secondary line. Typically surfaces `{userInput}` for text-entry rewards. */
  subtitle: z.string().max(300).default("{userInput}"),
  /** Left-bar + badge accent. `#rrggbb` only — 8-char hex belongs on `cardBg`. */
  accent: z.string().regex(HEX_RGB).default("#a78bfa"),

  // Media -------------------------------------------------------------------
  /** Optional top-right image on the card. "" disables. */
  imageUrl: z.string().url().or(z.literal("")).default(""),
  /** Optional one-shot audio. "" disables. */
  audioUrl: z.string().url().or(z.literal("")).default(""),
  audioVolume: z.number().min(0).max(1).default(0.8),

  // Queue & motion (mirrors AlertBox — no coalesce: every redemption is a
  // unique celebration). ---------------------------------------------------
  displayMs: z.number().int().min(500).max(30_000).default(4_000),
  spacingMs: z.number().int().min(0).max(5_000).default(250),
  maxQueue: z.number().int().min(1).max(100).default(20),
  entranceAnim: z.enum(["slide-up", "slide-in", "scale", "fade"]).default("scale"),
  exitAnim: z.enum(["slide-down", "slide-out", "scale", "fade"]).default("fade"),

  // Visual ------------------------------------------------------------------
  fontFamily: z.enum(["sans", "display", "mono"]).default("display"),
  titleSize: z.number().int().min(14).max(72).default(28),
  subtitleSize: z.number().int().min(10).max(36).default(16),
  showBadge: z.boolean().default(true),
  cardPadding: z.number().int().min(4).max(48).default(14),
  cardRadius: z.number().int().min(0).max(32).default(10),
  /** Accepts #rrggbb or #rrggbbaa so users can dial in translucent cards. */
  cardBg: z.string().regex(HEX_RGB_OR_RGBA).default("#11141bcc"),
  textShadow: z.boolean().default(true),

  /**
   * When true the subtitle DOM node is omitted entirely if `{userInput}`
   * resolves to an empty string. Keeps cards for input-less rewards from
   * leaving a blank second line.
   */
  hideEmptySubtitle: z.boolean().default(true),
});

export type ChannelPointAlertProps = z.infer<typeof channelPointAlertSchema>;
