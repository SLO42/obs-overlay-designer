import { describe, expect, it } from "vitest";
import { imageSchema } from "./schema";

describe("imageSchema", () => {
  it("parses `{}` to the documented defaults", () => {
    const parsed = imageSchema.parse({});
    expect(parsed).toEqual({
      src: "",
      alt: "",
      fit: "contain",
      opacity: 1,
      flipX: false,
      flipY: false,
      tint: {
        color: "#00000000",
        blendMode: "multiply",
        enabled: false,
      },
    });
  });

  it("accepts an https URL as `src`", () => {
    const parsed = imageSchema.parse({ src: "https://example.com/a.png" });
    expect(parsed.src).toBe("https://example.com/a.png");
  });

  it("accepts a `data:` URI as `src` (e.g. base64 PNG pasted from devtools)", () => {
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const parsed = imageSchema.parse({ src: dataUrl });
    expect(parsed.src).toBe(dataUrl);
  });

  it("rejects a non-URL, non-data `src`", () => {
    expect(() => imageSchema.parse({ src: "not-a-url" })).toThrow();
    expect(() => imageSchema.parse({ src: "/relative/path.png" })).toThrow();
  });

  it("rejects a tint color that is not 6- or 8-char hex", () => {
    expect(() => imageSchema.parse({ tint: { color: "red" } })).toThrow();
    expect(() => imageSchema.parse({ tint: { color: "#fff" } })).toThrow();
    expect(() => imageSchema.parse({ tint: { color: "#zzzzzz" } })).toThrow();
  });

  it("accepts a full valid tint config", () => {
    const parsed = imageSchema.parse({
      tint: { color: "#ff000080", blendMode: "screen", enabled: true },
    });
    expect(parsed.tint).toEqual({
      color: "#ff000080",
      blendMode: "screen",
      enabled: true,
    });
  });
});
