import { describe, expect, it } from "vitest";
import { eventTickerSchema } from "./schema";

describe("eventTickerSchema", () => {
  it("parses `{}` to the documented defaults", () => {
    const parsed = eventTickerSchema.parse({});

    // Include flags
    expect(parsed.includeFollow).toBe(true);
    expect(parsed.includeSubscribe).toBe(true);
    expect(parsed.includeSubGift).toBe(true);
    expect(parsed.includeCheer).toBe(true);
    expect(parsed.includeRaid).toBe(true);
    expect(parsed.includeRedeem).toBe(false);
    expect(parsed.includeDonation).toBe(true);
    expect(parsed.includeChat).toBe(false);

    // Motion
    expect(parsed.pixelsPerSecond).toBe(60);
    expect(parsed.direction).toBe("left");
    expect(parsed.restAfterMs).toBe(15_000);
    expect(parsed.gapPx).toBe(48);

    // Capacity
    expect(parsed.maxEntries).toBe(40);
    expect(parsed.entryLifetimeMs).toBe(120_000);
    expect(parsed.coalesceWindowMs).toBe(1_500);

    // Visual
    expect(parsed.fontFamily).toBe("sans");
    expect(parsed.fontSize).toBe(16);
    expect(parsed.padY).toBe(6);
    expect(parsed.padX).toBe(10);
    expect(parsed.gap).toBe(6);
    expect(parsed.borderRadius).toBe(6);
    expect(parsed.bg).toBe("#11141bcc");
    expect(parsed.textColor).toBe("#e6e8ef");
    expect(parsed.showIcons).toBe(true);
    expect(parsed.showTimestamps).toBe(false);
    expect(parsed.textShadow).toBe(true);
  });

  it("rejects invalid bg and textColor", () => {
    // bg accepts 6- or 8-char hex
    expect(eventTickerSchema.parse({ bg: "#112233" }).bg).toBe("#112233");
    expect(eventTickerSchema.parse({ bg: "#11223344" }).bg).toBe("#11223344");
    expect(() => eventTickerSchema.parse({ bg: "red" })).toThrow();
    expect(() => eventTickerSchema.parse({ bg: "#abc" })).toThrow();

    // textColor is 6-char hex only — no alpha allowed
    expect(eventTickerSchema.parse({ textColor: "#abcdef" }).textColor).toBe("#abcdef");
    expect(() => eventTickerSchema.parse({ textColor: "#11223344" })).toThrow();
    expect(() => eventTickerSchema.parse({ textColor: "rebeccapurple" })).toThrow();
  });

  it("enforces pixelsPerSecond range (10..400, integer)", () => {
    expect(() => eventTickerSchema.parse({ pixelsPerSecond: 9 })).toThrow();
    expect(() => eventTickerSchema.parse({ pixelsPerSecond: 401 })).toThrow();
    expect(() => eventTickerSchema.parse({ pixelsPerSecond: 60.5 })).toThrow();
    expect(eventTickerSchema.parse({ pixelsPerSecond: 10 }).pixelsPerSecond).toBe(10);
    expect(eventTickerSchema.parse({ pixelsPerSecond: 400 }).pixelsPerSecond).toBe(400);
  });

  it("enforces maxEntries and entryLifetimeMs ranges", () => {
    expect(() => eventTickerSchema.parse({ maxEntries: 0 })).toThrow();
    expect(() => eventTickerSchema.parse({ maxEntries: 201 })).toThrow();
    expect(eventTickerSchema.parse({ maxEntries: 1 }).maxEntries).toBe(1);
    expect(eventTickerSchema.parse({ maxEntries: 200 }).maxEntries).toBe(200);

    expect(() => eventTickerSchema.parse({ entryLifetimeMs: 999 })).toThrow();
    expect(() => eventTickerSchema.parse({ entryLifetimeMs: 600_001 })).toThrow();
    expect(eventTickerSchema.parse({ entryLifetimeMs: 1_000 }).entryLifetimeMs).toBe(1_000);
    expect(eventTickerSchema.parse({ entryLifetimeMs: 600_000 }).entryLifetimeMs).toBe(600_000);
  });

  it("rejects unknown direction values", () => {
    expect(() => eventTickerSchema.parse({ direction: "up" })).toThrow();
    expect(() => eventTickerSchema.parse({ direction: "down" })).toThrow();
    expect(eventTickerSchema.parse({ direction: "left" }).direction).toBe("left");
    expect(eventTickerSchema.parse({ direction: "right" }).direction).toBe("right");
  });

  it("include-* flags are all defaulted booleans and accept overrides", () => {
    // The seven flags that default true + one that defaults false are all
    // pure booleans — confirm both the defaults *and* that explicit
    // overrides parse through unchanged.
    const allFlags = [
      "includeFollow",
      "includeSubscribe",
      "includeSubGift",
      "includeCheer",
      "includeRaid",
      "includeRedeem",
      "includeDonation",
      "includeChat",
    ] as const;

    const defaults = eventTickerSchema.parse({});
    for (const key of allFlags) {
      expect(typeof defaults[key]).toBe("boolean");
    }

    // Flip every flag and round-trip.
    const flipped = eventTickerSchema.parse(
      Object.fromEntries(allFlags.map((k) => [k, !defaults[k]])),
    );
    for (const key of allFlags) {
      expect(flipped[key]).toBe(!defaults[key]);
    }

    // Reject a non-boolean value.
    expect(() => eventTickerSchema.parse({ includeFollow: "yes" })).toThrow();
  });

  it("enforces coalesceWindowMs and restAfterMs ranges", () => {
    expect(() => eventTickerSchema.parse({ coalesceWindowMs: -1 })).toThrow();
    expect(() => eventTickerSchema.parse({ coalesceWindowMs: 10_001 })).toThrow();
    expect(eventTickerSchema.parse({ coalesceWindowMs: 0 }).coalesceWindowMs).toBe(0);
    expect(eventTickerSchema.parse({ coalesceWindowMs: 10_000 }).coalesceWindowMs).toBe(10_000);

    expect(() => eventTickerSchema.parse({ restAfterMs: -1 })).toThrow();
    expect(() => eventTickerSchema.parse({ restAfterMs: 120_001 })).toThrow();
    expect(eventTickerSchema.parse({ restAfterMs: 0 }).restAfterMs).toBe(0);
  });

  it("covers sans / display / mono for fontFamily and rejects others", () => {
    expect(eventTickerSchema.parse({ fontFamily: "sans" }).fontFamily).toBe("sans");
    expect(eventTickerSchema.parse({ fontFamily: "display" }).fontFamily).toBe("display");
    expect(eventTickerSchema.parse({ fontFamily: "mono" }).fontFamily).toBe("mono");
    expect(() => eventTickerSchema.parse({ fontFamily: "serif" })).toThrow();
  });
});
