import type { EmotionProfile } from "../types";

/**
 * Resolve a `SpeechSynthesisVoice` from a pool using an optional hint.
 *
 * Order of preference:
 *  1. `hint.nameIncludes` — substring match against `voice.name` (ci).
 *  2. `hint.lang` (or `langFallback`) — startsWith match against `voice.lang`.
 *  3. First voice whose lang starts with `langFallback ?? "en"`.
 *  4. `null` if nothing matches.
 *
 * Gender hints are intentionally advisory — the Web Speech API does not
 * expose gender, so we can't filter on it. We honor `nameIncludes` when
 * it happens to correlate (e.g. "Zira" / "David" on Windows) but don't
 * attempt heuristics.
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  hint: EmotionProfile["voice"] | undefined,
  langFallback?: string,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  // 1. nameIncludes.
  if (hint?.nameIncludes) {
    const needle = hint.nameIncludes.toLowerCase();
    const byName = voices.find((v) => v.name.toLowerCase().includes(needle));
    if (byName) return byName;
    // fall through: a name hint that doesn't match is best-effort; we
    // still try the lang branch below so a misspelled name doesn't kill
    // the pick.
  }

  // 2. explicit lang hint. If the hint explicitly asks for a lang that
  // the voice pool can't serve, we return null rather than surprise the
  // caller with a different-language voice.
  if (hint?.lang) {
    const byLang = voices.find((v) => v.lang.toLowerCase().startsWith(hint.lang!.toLowerCase()));
    return byLang ?? null;
  }

  // 3. caller-supplied langFallback (no profile-level hint).
  if (langFallback) {
    const byFallback = voices.find((v) =>
      v.lang.toLowerCase().startsWith(langFallback.toLowerCase()),
    );
    return byFallback ?? null;
  }

  // 4. final default — first English voice if any.
  const byDefault = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  return byDefault ?? null;
}
