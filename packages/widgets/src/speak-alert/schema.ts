import { z } from "zod";

/** `#rrggbb`. */
const HEX_RGB = /^#[0-9a-fA-F]{6}$/;
/** `#rrggbb` or `#rrggbbaa`. */
const HEX_RGB_OR_RGBA = /^#[0-9a-fA-F]{8}$|^#[0-9a-fA-F]{6}$/;

/**
 * Animation spec for a single emotion. The SpeakAlert runtime listens for
 * `start` events from `@obs/tts`'s SpeakQueue and, when `effect !== "none"`,
 * plays the matching `@obs/effects` player on the card. `intensity`
 * multiplies each effect's amplitude/scale so users can tune reactions
 * per emotion.
 */
const emotionAnimationSchema = z.object({
  /** Effect type to fire on the card when this emotion's segment starts speaking. */
  effect: z.enum(["none", "shake", "flash", "zoom-punch"]).default("none"),
  /** Intensity multiplier applied to the effect's default amplitude/scale. 1 = default. */
  intensity: z.number().min(0.1).max(3).default(1),
});

export type EmotionAnimation = z.infer<typeof emotionAnimationSchema>;

/**
 * Default emotion → animation map. Mirrors the eight built-in emotion
 * profiles in `@obs/tts`'s BUILTIN_PROFILES — if a project adds custom
 * emotions the inspector lets users extend this record.
 */
export const DEFAULT_EMOTION_ANIMATIONS: Record<string, EmotionAnimation> = {
  normal: { effect: "none", intensity: 1 },
  shy: { effect: "zoom-punch", intensity: 0.8 },
  whisper: { effect: "none", intensity: 1 },
  angry: { effect: "shake", intensity: 1.5 },
  excited: { effect: "zoom-punch", intensity: 1.3 },
  sad: { effect: "none", intensity: 1 },
  happy: { effect: "zoom-punch", intensity: 1.1 },
  robotic: { effect: "flash", intensity: 0.6 },
};

/**
 * SpeakAlert widget schema. Consumes chat/donation/alert-style events and
 * speaks the configured text aloud via Web Speech while animating the
 * rendered card in sync with the emotion tags the message carries.
 *
 * Every field has `.default(...)` so `speakAlertSchema.parse({})` produces
 * a fully-populated props bag.
 */
export const speakAlertSchema = z.object({
  // Event filtering --------------------------------------------------------
  speakDonation: z.boolean().default(true),
  speakCheer: z.boolean().default(false),
  speakSubscribe: z.boolean().default(false),
  speakFollow: z.boolean().default(false),
  speakRaid: z.boolean().default(false),
  speakRedeem: z.boolean().default(false),

  // Thresholds (minor units for amounts, raw bit count for cheer) ----------
  minDonationAmount: z.number().int().min(0).default(100),
  minCheerBits: z.number().int().min(0).default(100),

  // Templating -------------------------------------------------------------
  titleTemplate: z.string().default("{user} · {amount} {currency}"),
  /**
   * Body template — whatever text gets SPOKEN. Defaults to "{message}";
   * an empty resolved string falls back to a silent card.
   */
  speakTemplate: z.string().default("{message}"),

  // TTS parameters ---------------------------------------------------------
  ttsEnabled: z.boolean().default(true),
  /** Master multiplier applied on top of each emotion profile's rate. */
  ttsRate: z.number().min(0.5).max(1.6).default(1),
  ttsVolume: z.number().min(0).max(1).default(1),
  ttsDefaultEmotion: z.string().default("normal"),
  ttsLang: z.string().default("en-US"),
  /** Empty string = auto-pick based on lang + profile hints. */
  ttsVoiceName: z.string().default(""),

  // Emotion → animation mapping -------------------------------------------
  animateOnSegments: z.boolean().default(true),
  emotionAnimations: z
    .record(z.string(), emotionAnimationSchema)
    .default({ ...DEFAULT_EMOTION_ANIMATIONS }),

  // Queue / pacing ---------------------------------------------------------
  displayMs: z.number().int().min(500).max(30_000).default(6_000),
  spacingMs: z.number().int().min(0).max(5_000).default(400),
  maxQueue: z.number().int().min(1).max(100).default(20),
  entranceAnim: z.enum(["slide-up", "slide-in", "scale", "fade"]).default("scale"),
  exitAnim: z.enum(["slide-down", "slide-out", "scale", "fade"]).default("fade"),

  // Visuals — mirror AlertBox so users feel at home ------------------------
  fontFamily: z.enum(["sans", "display", "mono"]).default("display"),
  titleSize: z.number().int().min(14).max(72).default(28),
  messageSize: z.number().int().min(10).max(48).default(20),
  /** Color the card accent based on the event's source (vs. `accentOverride`). */
  accentFromSource: z.boolean().default(true),
  accentOverride: z.string().regex(HEX_RGB).default("#8b5cf6"),
  cardBg: z.string().regex(HEX_RGB_OR_RGBA).default("#11141bcc"),
  cardPadding: z.number().int().min(4).max(48).default(16),
  cardRadius: z.number().int().min(0).max(32).default(10),
  textShadow: z.boolean().default(true),

  // Word highlight via SpeechSynthesis boundary events --------------------
  highlightCurrentWord: z.boolean().default(true),
  highlightColor: z.string().regex(HEX_RGB).default("#a78bfa"),
});

export type SpeakAlertProps = z.infer<typeof speakAlertSchema>;
