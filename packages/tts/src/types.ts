/**
 * Public type surface for @obs/tts.
 *
 * The engine parses a message like "(shy) hi (excited) yo" into a list
 * of `Segment`s, then looks each segment's `emotion` up in an
 * `EmotionProfile` map to decide rate/pitch/volume/voice for that chunk
 * of speech. Events (`SpeakEvent`) let widget runtimes sync animations
 * to utterance + word-level progress.
 */

/** A parsed chunk of the original message, tagged with its emotion (if any). */
export interface Segment {
  /** The spoken text (tag syntax already stripped). */
  text: string;
  /** Emotion name (lowercase) when a preceding tag set one; `"normal"` before any tag. */
  emotion: string;
  /** Character range in the original message. */
  range: { start: number; end: number };
}

/** Voice + prosody + extra hooks for one emotion. */
export interface EmotionProfile {
  name: string;
  /** 0.1..10 per Web Speech spec; sensible range 0.5..1.6. */
  rate: number;
  /** 0..2 per Web Speech spec; sensible 0.5..1.8. */
  pitch: number;
  /** 0..1. */
  volume: number;
  /** Optional: pick a voice matching this hint when the platform has one. */
  voice?: { nameIncludes?: string; lang?: string; genderHint?: "male" | "female" };
  /**
   * Optional: a visual cue other systems (widget animations) can react
   * to. Free-form string like "shake:subtle" or "wobble:slow". The TTS
   * engine does not interpret it — it is surfaced on `SpeakEvent` via
   * `segment.emotion` and consumers can look the hint up themselves.
   */
  animationHint?: string;
}

export interface SpeakOptions {
  /**
   * Profile lookup map. Any emotion name found in the message must
   * resolve here or fallback to the `defaultEmotion` (or `"normal"`).
   */
  profiles: Record<string, EmotionProfile>;
  /** Which profile to use when the message has no tags. Defaults to `"normal"`. */
  defaultEmotion?: string;
  /** Master rate multiplier applied on top of per-emotion rate. Defaults to 1. */
  rateMultiplier?: number;
  /** Master volume multiplier. Defaults to 1. */
  volumeMultiplier?: number;
  /** Lang override for voice matching (e.g. "en-US"). */
  lang?: string;
}

export type SpeakEvent =
  | { type: "start"; segmentIndex: number; segment: Segment }
  | {
      type: "boundary";
      segmentIndex: number;
      segment: Segment;
      /** Character offset within the segment's text. */
      charIndex: number;
      /** Length of the word/token the boundary event describes. */
      charLength: number;
    }
  | { type: "end"; segmentIndex: number; segment: Segment }
  | { type: "finish" }
  | { type: "error"; error: Error };

export interface SpeakHandle {
  /** Cancel in-flight speech and stop emitting events. Idempotent. */
  cancel(): void;
  /** Resolves when the queue ends (naturally, via cancel, or via fatal error). */
  readonly done: Promise<void>;
  /**
   * Subscribe to `SpeakEvent`s. Returns an unsubscribe function.
   * Safe to call after `done` resolves — the listener just never fires.
   */
  readonly onEvent: (listener: (e: SpeakEvent) => void) => () => void;
}
