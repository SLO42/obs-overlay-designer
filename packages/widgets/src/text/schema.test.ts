import { describe, expect, it } from "vitest";
import { textSchema } from "./schema";

describe("textSchema", () => {
  it("parses `{}` to the documented defaults", () => {
    const parsed = textSchema.parse({});
    expect(parsed).toEqual({
      content: "Text",
      fontFamily: "sans",
      fontSize: 48,
      fontWeight: "600",
      color: "#ffffff",
      align: "center",
      letterSpacing: 0,
      lineHeight: 1.2,
      background: {
        color: "#00000000",
        paddingX: 0,
        paddingY: 0,
        radius: 0,
      },
      textShadow: {
        x: 0,
        y: 2,
        blur: 4,
        color: "#000000cc",
        enabled: true,
      },
    });
  });

  it("rejects a color that is not a hex string", () => {
    expect(() => textSchema.parse({ color: "red" })).toThrow();
    expect(() => textSchema.parse({ color: "#fff" })).toThrow();
    // 8-char (with alpha) is not allowed for `color` — only background/shadow.
    expect(() => textSchema.parse({ color: "#ffffffff" })).toThrow();
  });

  it("rejects a fontSize that falls outside [8, 512]", () => {
    expect(() => textSchema.parse({ fontSize: 7 })).toThrow();
    expect(() => textSchema.parse({ fontSize: 513 })).toThrow();
    expect(() => textSchema.parse({ fontSize: 48.5 })).toThrow();
  });

  it("round-trips a fully-specified input", () => {
    const input = {
      content: "Hello stream",
      fontFamily: "display-sketch" as const,
      fontSize: 96,
      fontWeight: "700" as const,
      color: "#abcdef",
      align: "left" as const,
      letterSpacing: 0.05,
      lineHeight: 1.4,
      background: {
        color: "#11223344",
        paddingX: 16,
        paddingY: 8,
        radius: 12,
      },
      textShadow: {
        x: -4,
        y: 4,
        blur: 8,
        color: "#00000080",
        enabled: false,
      },
    };
    expect(textSchema.parse(input)).toEqual(input);
  });
});
