import { describe, expect, it } from "vitest";
import { alertBoxSchema } from "./schema";

describe("alertBoxSchema", () => {
  it("parses `{}` to the documented top-level defaults", () => {
    const parsed = alertBoxSchema.parse({});
    expect(parsed.displayMs).toBe(5_000);
    expect(parsed.spacingMs).toBe(300);
    expect(parsed.coalesceWindowMs).toBe(750);
    expect(parsed.maxQueue).toBe(25);
    expect(parsed.entranceAnim).toBe("slide-up");
    expect(parsed.exitAnim).toBe("fade");
    expect(parsed.fontFamily).toBe("display");
    expect(parsed.titleSize).toBe(36);
    expect(parsed.subtitleSize).toBe(18);
    expect(parsed.showBadge).toBe(true);
    expect(parsed.cardPadding).toBe(16);
    expect(parsed.cardRadius).toBe(10);
    expect(parsed.cardBg).toBe("#11141bcc");
    expect(parsed.textShadow).toBe(true);
  });

  it("fills every event template with its per-kind defaults", () => {
    const parsed = alertBoxSchema.parse({});
    // Follow
    expect(parsed.follow.enabled).toBe(true);
    expect(parsed.follow.title).toBe("New follower!");
    expect(parsed.follow.subtitle).toBe("{user}");
    expect(parsed.follow.accent).toBe("#4ade80");
    expect(parsed.follow.threshold).toBe(0);
    expect(parsed.follow.media).toEqual({
      imageUrl: "",
      audioUrl: "",
      audioVolume: 0.8,
    });

    // Subscribe
    expect(parsed.subscribe.title).toBe("New subscriber!");
    expect(parsed.subscribe.subtitle).toBe("{user} subscribed at Tier {tierLabel}");
    expect(parsed.subscribe.accent).toBe("#a78bfa");

    // Sub gift
    expect(parsed.subGift.title).toBe("Gift sub!");
    expect(parsed.subGift.subtitle).toBe("{user} gifted {count} sub{countPlural}");

    // Cheer
    expect(parsed.cheer.title).toBe("{bits} bits!");
    expect(parsed.cheer.accent).toBe("#f5b95a");

    // Raid
    expect(parsed.raid.title).toBe("Raid from {from}!");
    expect(parsed.raid.accent).toBe("#ff6b8a");

    // Donation
    expect(parsed.donation.title).toBe("{amount} {currency}!");
    expect(parsed.donation.accent).toBe("#4da3ff");
  });

  it("rejects an invalid accent color on any event template", () => {
    expect(() => alertBoxSchema.parse({ follow: { accent: "red" } })).toThrow();
    expect(() => alertBoxSchema.parse({ follow: { accent: "#fff" } })).toThrow();
    // 8-char hex is NOT accepted for accent (event accent is #rrggbb only).
    expect(() => alertBoxSchema.parse({ cheer: { accent: "#11223344" } })).toThrow();
    // Sanity: a well-formed 6-char hex parses.
    const ok = alertBoxSchema.parse({ cheer: { accent: "#abcdef" } });
    expect(ok.cheer.accent).toBe("#abcdef");
  });

  it("rejects unknown entranceAnim / exitAnim values", () => {
    expect(() => alertBoxSchema.parse({ entranceAnim: "zoom" })).toThrow();
    expect(() => alertBoxSchema.parse({ exitAnim: "zoom" })).toThrow();
    expect(alertBoxSchema.parse({ entranceAnim: "scale" }).entranceAnim).toBe("scale");
    expect(alertBoxSchema.parse({ exitAnim: "slide-out" }).exitAnim).toBe("slide-out");
  });

  it("enforces displayMs and spacingMs ranges", () => {
    expect(() => alertBoxSchema.parse({ displayMs: 499 })).toThrow();
    expect(() => alertBoxSchema.parse({ displayMs: 30_001 })).toThrow();
    expect(() => alertBoxSchema.parse({ spacingMs: -1 })).toThrow();
    expect(() => alertBoxSchema.parse({ spacingMs: 5_001 })).toThrow();
    // Boundaries succeed.
    expect(alertBoxSchema.parse({ displayMs: 500 }).displayMs).toBe(500);
    expect(alertBoxSchema.parse({ displayMs: 30_000 }).displayMs).toBe(30_000);
    expect(alertBoxSchema.parse({ spacingMs: 0 }).spacingMs).toBe(0);
  });

  it("rejects negative thresholds and non-integer thresholds", () => {
    expect(() => alertBoxSchema.parse({ cheer: { threshold: -1 } })).toThrow();
    expect(() => alertBoxSchema.parse({ cheer: { threshold: 1.5 } })).toThrow();
    // Default is 0
    expect(alertBoxSchema.parse({}).cheer.threshold).toBe(0);
    // Positive integer passes
    expect(alertBoxSchema.parse({ cheer: { threshold: 500 } }).cheer.threshold).toBe(500);
  });

  it("round-trips a custom subtitle template through each event template", () => {
    const parsed = alertBoxSchema.parse({
      follow: { subtitle: "Welcome {user}, enjoy the stream" },
      cheer: { subtitle: "{user} showered {bits} bits" },
    });
    expect(parsed.follow.subtitle).toBe("Welcome {user}, enjoy the stream");
    expect(parsed.cheer.subtitle).toBe("{user} showered {bits} bits");
    // Other templates kept their defaults.
    expect(parsed.raid.subtitle).toBe("{viewers} incoming");
  });

  it("covers sans / display / mono for fontFamily and rejects others", () => {
    expect(alertBoxSchema.parse({ fontFamily: "sans" }).fontFamily).toBe("sans");
    expect(alertBoxSchema.parse({ fontFamily: "display" }).fontFamily).toBe("display");
    expect(alertBoxSchema.parse({ fontFamily: "mono" }).fontFamily).toBe("mono");
    expect(() => alertBoxSchema.parse({ fontFamily: "serif" })).toThrow();
  });

  it("accepts 6- and 8-char hex for cardBg and rejects invalid values", () => {
    expect(alertBoxSchema.parse({ cardBg: "#112233" }).cardBg).toBe("#112233");
    expect(alertBoxSchema.parse({ cardBg: "#11223344" }).cardBg).toBe("#11223344");
    expect(() => alertBoxSchema.parse({ cardBg: "red" })).toThrow();
    expect(() => alertBoxSchema.parse({ cardBg: "#abc" })).toThrow();
  });

  it("enforces maxQueue, titleSize, subtitleSize, cardPadding, cardRadius ranges", () => {
    expect(() => alertBoxSchema.parse({ maxQueue: 0 })).toThrow();
    expect(() => alertBoxSchema.parse({ maxQueue: 101 })).toThrow();
    expect(() => alertBoxSchema.parse({ titleSize: 17 })).toThrow();
    expect(() => alertBoxSchema.parse({ titleSize: 97 })).toThrow();
    expect(() => alertBoxSchema.parse({ subtitleSize: 9 })).toThrow();
    expect(() => alertBoxSchema.parse({ subtitleSize: 49 })).toThrow();
    expect(() => alertBoxSchema.parse({ cardPadding: 3 })).toThrow();
    expect(() => alertBoxSchema.parse({ cardPadding: 49 })).toThrow();
    expect(() => alertBoxSchema.parse({ cardRadius: -1 })).toThrow();
    expect(() => alertBoxSchema.parse({ cardRadius: 33 })).toThrow();

    expect(alertBoxSchema.parse({ maxQueue: 1 }).maxQueue).toBe(1);
    expect(alertBoxSchema.parse({ maxQueue: 100 }).maxQueue).toBe(100);
  });

  it("allows disabling an event template via `enabled: false`", () => {
    const parsed = alertBoxSchema.parse({ follow: { enabled: false } });
    expect(parsed.follow.enabled).toBe(false);
    expect(parsed.follow.title).toBe("New follower!"); // other defaults intact
  });
});
