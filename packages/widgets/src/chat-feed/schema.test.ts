import { describe, expect, it } from "vitest";
import { chatFeedSchema } from "./schema";

describe("chatFeedSchema", () => {
  it("parses `{}` to the documented defaults", () => {
    const parsed = chatFeedSchema.parse({});
    expect(parsed).toEqual({
      fontSize: 16,
      fontFamily: "sans",
      density: "cozy",
      showBadges: true,
      showTimestamps: false,
      showPronouns: false,
      maxMessages: 50,
      fadeAfterMs: 0,
      fadeDurationMs: 500,
      entranceAnim: "slide-up",
      lineColor: "#ffffff",
      mentionColor: "#8b5cf6",
      backgroundColor: "#00000000",
      padding: 8,
      borderRadius: 6,
      textShadow: true,
      alignBottom: true,
    });
  });

  it("rejects an invalid color and accepts 6- or 8-char hex for bg/line/mention", () => {
    expect(() => chatFeedSchema.parse({ lineColor: "red" })).toThrow();
    expect(() => chatFeedSchema.parse({ lineColor: "#fff" })).toThrow();
    expect(() => chatFeedSchema.parse({ mentionColor: "not-a-hex" })).toThrow();
    // mentionColor rejects alpha-included hex — it's documented as #rrggbb only.
    expect(() => chatFeedSchema.parse({ mentionColor: "#11223344" })).toThrow();

    // Accepts 6-char
    expect(chatFeedSchema.parse({ lineColor: "#abcdef" }).lineColor).toBe("#abcdef");
    expect(chatFeedSchema.parse({ mentionColor: "#123456" }).mentionColor).toBe("#123456");
    // Accepts 8-char RGBA for line + bg
    expect(chatFeedSchema.parse({ lineColor: "#abcdef80" }).lineColor).toBe("#abcdef80");
    expect(chatFeedSchema.parse({ backgroundColor: "#00112233" }).backgroundColor).toBe(
      "#00112233",
    );
  });

  it("rejects a fontSize that falls outside [10, 48]", () => {
    expect(() => chatFeedSchema.parse({ fontSize: 9 })).toThrow();
    expect(() => chatFeedSchema.parse({ fontSize: 49 })).toThrow();
    // non-integer
    expect(() => chatFeedSchema.parse({ fontSize: 16.5 })).toThrow();
    // boundaries accepted
    expect(chatFeedSchema.parse({ fontSize: 10 }).fontSize).toBe(10);
    expect(chatFeedSchema.parse({ fontSize: 48 }).fontSize).toBe(48);
  });

  it("rejects unknown entranceAnim values", () => {
    expect(() => chatFeedSchema.parse({ entranceAnim: "zoom" })).toThrow();
    expect(() => chatFeedSchema.parse({ entranceAnim: "" })).toThrow();
    expect(chatFeedSchema.parse({ entranceAnim: "none" }).entranceAnim).toBe("none");
    expect(chatFeedSchema.parse({ entranceAnim: "fade" }).entranceAnim).toBe("fade");
    expect(chatFeedSchema.parse({ entranceAnim: "slide-up" }).entranceAnim).toBe("slide-up");
  });

  it("accepts every density enum value and rejects others", () => {
    expect(chatFeedSchema.parse({ density: "compact" }).density).toBe("compact");
    expect(chatFeedSchema.parse({ density: "cozy" }).density).toBe("cozy");
    expect(chatFeedSchema.parse({ density: "comfortable" }).density).toBe("comfortable");
    expect(() => chatFeedSchema.parse({ density: "spacious" })).toThrow();
  });

  it("clamps maxMessages at [1, 200]", () => {
    expect(() => chatFeedSchema.parse({ maxMessages: 0 })).toThrow();
    expect(() => chatFeedSchema.parse({ maxMessages: 201 })).toThrow();
    expect(() => chatFeedSchema.parse({ maxMessages: 12.5 })).toThrow();
    expect(chatFeedSchema.parse({ maxMessages: 1 }).maxMessages).toBe(1);
    expect(chatFeedSchema.parse({ maxMessages: 200 }).maxMessages).toBe(200);
  });

  it("round-trips a fully-specified input", () => {
    const input = {
      fontSize: 20,
      fontFamily: "mono" as const,
      density: "comfortable" as const,
      showBadges: false,
      showTimestamps: true,
      showPronouns: true,
      maxMessages: 25,
      fadeAfterMs: 5000,
      fadeDurationMs: 1000,
      entranceAnim: "fade" as const,
      lineColor: "#fefefe",
      mentionColor: "#ff0000",
      backgroundColor: "#000000aa",
      padding: 12,
      borderRadius: 16,
      textShadow: false,
      alignBottom: false,
    };
    expect(chatFeedSchema.parse(input)).toEqual(input);
  });
});
