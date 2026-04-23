import { describe, expect, it } from "vitest";
import { BUILTIN_PROFILES, resolveProfile, type BuiltinProfileName } from "./profiles";

describe("BUILTIN_PROFILES", () => {
  it("contains every documented starter emotion", () => {
    const expected: BuiltinProfileName[] = [
      "normal",
      "shy",
      "whisper",
      "angry",
      "excited",
      "sad",
      "happy",
      "robotic",
    ];
    for (const name of expected) {
      expect(BUILTIN_PROFILES[name]).toBeDefined();
      expect(BUILTIN_PROFILES[name].name).toBe(name);
    }
  });

  it("keeps every profile's prosody inside Web Speech's sensible range", () => {
    for (const p of Object.values(BUILTIN_PROFILES)) {
      expect(p.rate).toBeGreaterThanOrEqual(0.1);
      expect(p.rate).toBeLessThanOrEqual(10);
      expect(p.pitch).toBeGreaterThanOrEqual(0);
      expect(p.pitch).toBeLessThanOrEqual(2);
      expect(p.volume).toBeGreaterThanOrEqual(0);
      expect(p.volume).toBeLessThanOrEqual(1);
    }
  });
});

describe("resolveProfile", () => {
  it("returns the matching profile by name (case-insensitive)", () => {
    expect(resolveProfile("shy", BUILTIN_PROFILES)).toBe(BUILTIN_PROFILES.shy);
    expect(resolveProfile("SHY", BUILTIN_PROFILES)).toBe(BUILTIN_PROFILES.shy);
  });

  it("falls back to `normal` when the name is missing", () => {
    expect(resolveProfile("does-not-exist", BUILTIN_PROFILES)).toBe(BUILTIN_PROFILES.normal);
  });

  it("honors a custom fallback name", () => {
    expect(resolveProfile("does-not-exist", BUILTIN_PROFILES, "excited")).toBe(
      BUILTIN_PROFILES.excited,
    );
  });

  it("prefers a custom profile over the built-in of the same name", () => {
    const custom = { ...BUILTIN_PROFILES, shy: { ...BUILTIN_PROFILES.shy, rate: 1.42 } };
    expect(resolveProfile("shy", custom).rate).toBe(1.42);
  });

  it("returns a safe neutral profile when the map is broken", () => {
    const result = resolveProfile("shy", {});
    expect(result).toEqual({ name: "normal", rate: 1, pitch: 1, volume: 1 });
  });
});
