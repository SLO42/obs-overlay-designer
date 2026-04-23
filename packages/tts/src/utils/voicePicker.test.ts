import { describe, expect, it } from "vitest";
import { pickVoice } from "./voicePicker";

/**
 * A minimal fabricated voice set. `SpeechSynthesisVoice` is structurally
 * a DOM interface; we only need the fields the picker reads.
 */
const VOICES: SpeechSynthesisVoice[] = [
  { name: "Microsoft Zira", lang: "en-US", default: true, localService: true, voiceURI: "" },
  { name: "Microsoft David", lang: "en-US", default: false, localService: true, voiceURI: "" },
  {
    name: "Google UK English Male",
    lang: "en-GB",
    default: false,
    localService: false,
    voiceURI: "",
  },
  { name: "Google Deutsch", lang: "de-DE", default: false, localService: false, voiceURI: "" },
] as SpeechSynthesisVoice[];

describe("pickVoice", () => {
  it("matches by `nameIncludes` first (case-insensitive)", () => {
    const voice = pickVoice(VOICES, { nameIncludes: "david" });
    expect(voice?.name).toBe("Microsoft David");
  });

  it("falls through from `nameIncludes` miss to lang", () => {
    // Name doesn't match; we should fall through to lang filtering using
    // the hint.lang.
    const voice = pickVoice(VOICES, { nameIncludes: "NOPE", lang: "de" });
    expect(voice?.name).toBe("Google Deutsch");
  });

  it("filters by profile lang hint (startsWith)", () => {
    const voice = pickVoice(VOICES, { lang: "en-GB" });
    expect(voice?.name).toBe("Google UK English Male");
  });

  it("uses the fallback lang when no hint lang is given", () => {
    const voice = pickVoice(VOICES, undefined, "de");
    expect(voice?.name).toBe("Google Deutsch");
  });

  it("returns the first `en-*` voice when no hint or fallback is given", () => {
    const voice = pickVoice(VOICES, undefined);
    expect(voice?.name).toBe("Microsoft Zira");
  });

  it("returns null when no candidate exists", () => {
    const voice = pickVoice(VOICES, { lang: "ja" });
    expect(voice).toBeNull();
  });

  it("returns null for an empty pool", () => {
    expect(pickVoice([], { nameIncludes: "anything" })).toBeNull();
  });
});
