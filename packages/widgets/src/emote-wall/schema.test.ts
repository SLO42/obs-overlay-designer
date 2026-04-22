import { describe, expect, it } from "vitest";
import { emoteWallSchema } from "./schema";

describe("emoteWallSchema", () => {
  it("parses `{}` to the documented defaults", () => {
    const parsed = emoteWallSchema.parse({});
    expect(parsed.collectionWindowMs).toBe(1_200);
    expect(parsed.maxParticles).toBe(80);
    expect(parsed.spawnPerEmote).toBe(1);
    expect(parsed.mode).toBe("drop");
    expect(parsed.gravity).toBe(900);
    expect(parsed.bounce).toBe(0.4);
    expect(parsed.initialVelocityMin).toBe(120);
    expect(parsed.initialVelocityMax).toBe(320);
    expect(parsed.floatRiseSpeed).toBe(90);
    expect(parsed.floatWobbleAmp).toBe(24);
    expect(parsed.floatWobbleFreq).toBe(1.5);
    expect(parsed.particleSize).toBe(56);
    expect(parsed.particleRotation).toBe(true);
    expect(parsed.rotationSpeedMax).toBe(240);
    expect(parsed.lifetimeMs).toBe(6_000);
    expect(parsed.fadeOutMs).toBe(800);
    expect(parsed.spawnJitterPx).toBe(60);
    expect(parsed.includeFirstPartyEmotes).toBe(true);
    expect(parsed.includeCheermotes).toBe(true);
    expect(parsed.onlySubscribers).toBe(false);
    expect(parsed.bg).toBe("#00000000");
    expect(parsed.borderRadius).toBe(0);
  });

  it("rejects an invalid mode enum value", () => {
    expect(() => emoteWallSchema.parse({ mode: "zoom" })).toThrow();
    expect(() => emoteWallSchema.parse({ mode: "" })).toThrow();
    expect(emoteWallSchema.parse({ mode: "float" }).mode).toBe("float");
    expect(emoteWallSchema.parse({ mode: "burst" }).mode).toBe("burst");
  });

  it("gravity accepts negative (upward) values and enforces its bounds", () => {
    expect(emoteWallSchema.parse({ gravity: -500 }).gravity).toBe(-500);
    expect(emoteWallSchema.parse({ gravity: 0 }).gravity).toBe(0);
    expect(emoteWallSchema.parse({ gravity: 2000 }).gravity).toBe(2000);
    expect(() => emoteWallSchema.parse({ gravity: -2001 })).toThrow();
    expect(() => emoteWallSchema.parse({ gravity: 2001 })).toThrow();
  });

  it("enforces maxParticles and spawnPerEmote ranges", () => {
    expect(() => emoteWallSchema.parse({ maxParticles: 0 })).toThrow();
    expect(() => emoteWallSchema.parse({ maxParticles: 501 })).toThrow();
    expect(() => emoteWallSchema.parse({ maxParticles: 1.5 })).toThrow();
    expect(emoteWallSchema.parse({ maxParticles: 1 }).maxParticles).toBe(1);
    expect(emoteWallSchema.parse({ maxParticles: 500 }).maxParticles).toBe(500);

    expect(() => emoteWallSchema.parse({ spawnPerEmote: 0 })).toThrow();
    expect(() => emoteWallSchema.parse({ spawnPerEmote: 11 })).toThrow();
    expect(emoteWallSchema.parse({ spawnPerEmote: 3 }).spawnPerEmote).toBe(3);
  });

  it("accepts both 6- and 8-char hex for bg; rejects others", () => {
    expect(emoteWallSchema.parse({ bg: "#112233" }).bg).toBe("#112233");
    expect(emoteWallSchema.parse({ bg: "#11223344" }).bg).toBe("#11223344");
    expect(() => emoteWallSchema.parse({ bg: "red" })).toThrow();
    expect(() => emoteWallSchema.parse({ bg: "#abc" })).toThrow();
    expect(() => emoteWallSchema.parse({ bg: "#abcde" })).toThrow();
  });

  it("enforces bounce (0..1), particleSize (16..256), and lifetimeMs (500..60000)", () => {
    expect(() => emoteWallSchema.parse({ bounce: -0.01 })).toThrow();
    expect(() => emoteWallSchema.parse({ bounce: 1.01 })).toThrow();
    expect(emoteWallSchema.parse({ bounce: 0 }).bounce).toBe(0);
    expect(emoteWallSchema.parse({ bounce: 1 }).bounce).toBe(1);

    expect(() => emoteWallSchema.parse({ particleSize: 15 })).toThrow();
    expect(() => emoteWallSchema.parse({ particleSize: 257 })).toThrow();
    expect(() => emoteWallSchema.parse({ particleSize: 40.5 })).toThrow();
    expect(emoteWallSchema.parse({ particleSize: 16 }).particleSize).toBe(16);

    expect(() => emoteWallSchema.parse({ lifetimeMs: 499 })).toThrow();
    expect(() => emoteWallSchema.parse({ lifetimeMs: 60_001 })).toThrow();
    expect(emoteWallSchema.parse({ lifetimeMs: 500 }).lifetimeMs).toBe(500);
    expect(emoteWallSchema.parse({ lifetimeMs: 60_000 }).lifetimeMs).toBe(60_000);
  });

  it("boolean flags round-trip and reject non-booleans", () => {
    const flags = [
      "particleRotation",
      "includeFirstPartyEmotes",
      "includeCheermotes",
      "onlySubscribers",
    ] as const;
    const defaults = emoteWallSchema.parse({});
    for (const key of flags) {
      expect(typeof defaults[key]).toBe("boolean");
    }
    const flipped = emoteWallSchema.parse(Object.fromEntries(flags.map((k) => [k, !defaults[k]])));
    for (const key of flags) {
      expect(flipped[key]).toBe(!defaults[key]);
    }
    expect(() => emoteWallSchema.parse({ particleRotation: "yes" })).toThrow();
  });

  it("rotationSpeedMax accepts 0 (disables spin) and caps at 720", () => {
    expect(emoteWallSchema.parse({ rotationSpeedMax: 0 }).rotationSpeedMax).toBe(0);
    expect(emoteWallSchema.parse({ rotationSpeedMax: 720 }).rotationSpeedMax).toBe(720);
    expect(() => emoteWallSchema.parse({ rotationSpeedMax: -1 })).toThrow();
    expect(() => emoteWallSchema.parse({ rotationSpeedMax: 721 })).toThrow();
  });
});
