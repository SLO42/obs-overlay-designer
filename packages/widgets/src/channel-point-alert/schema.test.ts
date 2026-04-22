import { describe, expect, it } from "vitest";
import { channelPointAlertSchema } from "./schema";

describe("channelPointAlertSchema", () => {
  it("parses `{}` to the documented defaults", () => {
    const parsed = channelPointAlertSchema.parse({});
    expect(parsed.rewardId).toBe("");
    expect(parsed.rewardTitleContains).toBe("");
    expect(parsed.title).toBe("{user} redeemed {rewardTitle}");
    expect(parsed.subtitle).toBe("{userInput}");
    expect(parsed.accent).toBe("#a78bfa");
    expect(parsed.imageUrl).toBe("");
    expect(parsed.audioUrl).toBe("");
    expect(parsed.audioVolume).toBe(0.8);
    expect(parsed.displayMs).toBe(4_000);
    expect(parsed.spacingMs).toBe(250);
    expect(parsed.maxQueue).toBe(20);
    expect(parsed.entranceAnim).toBe("scale");
    expect(parsed.exitAnim).toBe("fade");
    expect(parsed.fontFamily).toBe("display");
    expect(parsed.titleSize).toBe(28);
    expect(parsed.subtitleSize).toBe(16);
    expect(parsed.showBadge).toBe(true);
    expect(parsed.cardPadding).toBe(14);
    expect(parsed.cardRadius).toBe(10);
    expect(parsed.cardBg).toBe("#11141bcc");
    expect(parsed.textShadow).toBe(true);
    expect(parsed.hideEmptySubtitle).toBe(true);
  });

  it("rejects an invalid accent color", () => {
    expect(() => channelPointAlertSchema.parse({ accent: "red" })).toThrow();
    expect(() => channelPointAlertSchema.parse({ accent: "#fff" })).toThrow();
    // 8-char hex is NOT accepted for accent.
    expect(() => channelPointAlertSchema.parse({ accent: "#11223344" })).toThrow();
    // A well-formed 6-char hex parses.
    expect(channelPointAlertSchema.parse({ accent: "#abcdef" }).accent).toBe("#abcdef");
  });

  it("accepts an empty rewardId (the match-all sentinel)", () => {
    expect(channelPointAlertSchema.parse({ rewardId: "" }).rewardId).toBe("");
    expect(channelPointAlertSchema.parse({}).rewardId).toBe("");
    expect(channelPointAlertSchema.parse({ rewardId: "abc-123-xyz" }).rewardId).toBe("abc-123-xyz");
    // Caps out at 100 chars.
    expect(() => channelPointAlertSchema.parse({ rewardId: "x".repeat(101) })).toThrow();
  });

  it("enforces displayMs range", () => {
    expect(() => channelPointAlertSchema.parse({ displayMs: 499 })).toThrow();
    expect(() => channelPointAlertSchema.parse({ displayMs: 30_001 })).toThrow();
    expect(channelPointAlertSchema.parse({ displayMs: 500 }).displayMs).toBe(500);
    expect(channelPointAlertSchema.parse({ displayMs: 30_000 }).displayMs).toBe(30_000);
  });

  it("enforces audioVolume range (0..1)", () => {
    expect(() => channelPointAlertSchema.parse({ audioVolume: -0.01 })).toThrow();
    expect(() => channelPointAlertSchema.parse({ audioVolume: 1.01 })).toThrow();
    expect(channelPointAlertSchema.parse({ audioVolume: 0 }).audioVolume).toBe(0);
    expect(channelPointAlertSchema.parse({ audioVolume: 1 }).audioVolume).toBe(1);
    expect(channelPointAlertSchema.parse({ audioVolume: 0.25 }).audioVolume).toBe(0.25);
  });

  it("defaults hideEmptySubtitle to true", () => {
    expect(channelPointAlertSchema.parse({}).hideEmptySubtitle).toBe(true);
    expect(channelPointAlertSchema.parse({ hideEmptySubtitle: false }).hideEmptySubtitle).toBe(
      false,
    );
  });

  it("rejects unknown entranceAnim / exitAnim values", () => {
    expect(() => channelPointAlertSchema.parse({ entranceAnim: "zoom" })).toThrow();
    expect(() => channelPointAlertSchema.parse({ exitAnim: "zoom" })).toThrow();
    expect(channelPointAlertSchema.parse({ entranceAnim: "fade" }).entranceAnim).toBe("fade");
    expect(channelPointAlertSchema.parse({ exitAnim: "scale" }).exitAnim).toBe("scale");
  });

  it("accepts both 6- and 8-char hex for cardBg", () => {
    expect(channelPointAlertSchema.parse({ cardBg: "#112233" }).cardBg).toBe("#112233");
    expect(channelPointAlertSchema.parse({ cardBg: "#11223344" }).cardBg).toBe("#11223344");
    expect(() => channelPointAlertSchema.parse({ cardBg: "red" })).toThrow();
    expect(() => channelPointAlertSchema.parse({ cardBg: "#abc" })).toThrow();
  });

  it("enforces maxQueue, titleSize, subtitleSize, cardPadding, cardRadius ranges", () => {
    expect(() => channelPointAlertSchema.parse({ maxQueue: 0 })).toThrow();
    expect(() => channelPointAlertSchema.parse({ maxQueue: 101 })).toThrow();
    expect(() => channelPointAlertSchema.parse({ titleSize: 13 })).toThrow();
    expect(() => channelPointAlertSchema.parse({ titleSize: 73 })).toThrow();
    expect(() => channelPointAlertSchema.parse({ subtitleSize: 9 })).toThrow();
    expect(() => channelPointAlertSchema.parse({ subtitleSize: 37 })).toThrow();
    expect(() => channelPointAlertSchema.parse({ cardPadding: 3 })).toThrow();
    expect(() => channelPointAlertSchema.parse({ cardPadding: 49 })).toThrow();
    expect(() => channelPointAlertSchema.parse({ cardRadius: -1 })).toThrow();
    expect(() => channelPointAlertSchema.parse({ cardRadius: 33 })).toThrow();

    expect(channelPointAlertSchema.parse({ maxQueue: 1 }).maxQueue).toBe(1);
    expect(channelPointAlertSchema.parse({ maxQueue: 100 }).maxQueue).toBe(100);
  });
});
