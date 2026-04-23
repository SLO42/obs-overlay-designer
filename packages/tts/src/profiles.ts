import type { EmotionProfile } from "./types";

/**
 * Built-in profile names. Using a string-literal key map (rather than
 * `Record<string, EmotionProfile>`) preserves exact-key knowledge, which
 * lets callers reference `BUILTIN_PROFILES.shy` directly under strict
 * `noUncheckedIndexedAccess` without an `as const` assertion.
 */
export type BuiltinProfileName =
  | "normal"
  | "shy"
  | "whisper"
  | "angry"
  | "excited"
  | "sad"
  | "happy"
  | "robotic";

/**
 * Library of starter emotion profiles. Every profile name is lowercase
 * because `parseEmotionTags` lowercases the emotion it extracts — if a
 * custom profile map reuses these keys they must also be lowercase.
 *
 * The concrete numbers below are opinionated defaults tuned for
 * everyday chat read-outs:
 *  - rate stays in 0.7..1.25 (Web Speech allows 0.1..10, but most
 *    voices clip or garble outside this window).
 *  - pitch stays in 0.5..1.25 (spec: 0..2; voices often ignore 0).
 *  - volume is a linear 0..1 multiplier.
 *
 * animationHint is consumed by Task 21's SpeakAlert widget (not this
 * package) — it's free-form and opaque to the TTS engine.
 */
export const BUILTIN_PROFILES: Record<BuiltinProfileName, EmotionProfile> = {
  normal: { name: "normal", rate: 1.0, pitch: 1.0, volume: 1.0, animationHint: "" },
  shy: { name: "shy", rate: 0.85, pitch: 1.15, volume: 0.7, animationHint: "shrink:subtle" },
  whisper: {
    name: "whisper",
    rate: 0.7,
    pitch: 0.9,
    volume: 0.35,
    animationHint: "fade:slow",
  },
  angry: { name: "angry", rate: 1.15, pitch: 0.75, volume: 1.0, animationHint: "shake:strong" },
  excited: {
    name: "excited",
    rate: 1.25,
    pitch: 1.25,
    volume: 1.0,
    animationHint: "bounce:fast",
  },
  sad: { name: "sad", rate: 0.75, pitch: 0.8, volume: 0.8, animationHint: "droop:slow" },
  happy: { name: "happy", rate: 1.1, pitch: 1.1, volume: 0.95, animationHint: "wiggle:soft" },
  robotic: {
    name: "robotic",
    rate: 0.9,
    pitch: 0.5,
    volume: 1.0,
    animationHint: "glitch:subtle",
  },
};

/**
 * Look up a profile by name. If missing, resolves the `fallback` — if
 * THAT is also missing, returns a last-resort neutral profile so callers
 * never receive `undefined` and can always configure an utterance.
 */
export function resolveProfile(
  name: string,
  profiles: Record<string, EmotionProfile>,
  fallback = "normal",
): EmotionProfile {
  const key = name.toLowerCase();
  const direct = profiles[key];
  if (direct) return direct;
  const fb = profiles[fallback];
  if (fb) return fb;
  // Defensive floor: the caller passed an empty or broken map. Return a
  // stable neutral profile instead of crashing the speaker.
  return { name: "normal", rate: 1, pitch: 1, volume: 1 };
}
