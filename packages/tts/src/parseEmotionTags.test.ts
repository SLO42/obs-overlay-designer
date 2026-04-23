import { describe, expect, it } from "vitest";
import { parseEmotionTags } from "./parseEmotionTags";

describe("parseEmotionTags", () => {
  it("returns one `normal` segment for a tag-free message", () => {
    const segs = parseEmotionTags("hello world");
    expect(segs).toEqual([
      { text: "hello world", emotion: "normal", range: { start: 0, end: 11 } },
    ]);
  });

  it("handles a leading tag", () => {
    const segs = parseEmotionTags("(shy)hi");
    expect(segs).toEqual([{ text: "hi", emotion: "shy", range: { start: 5, end: 7 } }]);
  });

  it("splits multiple tagged segments and preserves surrounding whitespace", () => {
    const msg = "a (whisper) b (normal) c";
    const segs = parseEmotionTags(msg);
    // "a " — normal, " b " — whisper, " c" — normal
    expect(segs).toEqual([
      { text: "a ", emotion: "normal", range: { start: 0, end: 2 } },
      { text: " b ", emotion: "whisper", range: { start: 11, end: 14 } },
      { text: " c", emotion: "normal", range: { start: 22, end: 24 } },
    ]);
  });

  it("accepts the asterisk form `(*name)`", () => {
    const segs = parseEmotionTags("(*shy) hello");
    expect(segs).toEqual([{ text: " hello", emotion: "shy", range: { start: 6, end: 12 } }]);
  });

  it("keeps unknown emotion names as-is (consumer decides the fallback)", () => {
    const segs = parseEmotionTags("(unknown) hi");
    expect(segs).toEqual([{ text: " hi", emotion: "unknown", range: { start: 9, end: 12 } }]);
  });

  it("treats an unmatched `(` as literal text", () => {
    const segs = parseEmotionTags("(shy");
    expect(segs).toEqual([{ text: "(shy", emotion: "normal", range: { start: 0, end: 4 } }]);
  });

  it("treats a `(name` with no close within 32 chars as literal", () => {
    // The `(` is literal because there is no matching `)` in the scan
    // window. The rest of the string speaks as normal.
    const segs = parseEmotionTags("(nopeclose and now some more text here");
    expect(segs).toEqual([
      {
        text: "(nopeclose and now some more text here",
        emotion: "normal",
        range: { start: 0, end: 38 },
      },
    ]);
  });

  it("honors `\\(` and `\\)` escapes (literal parens)", () => {
    const segs = parseEmotionTags("\\(shy\\) literal");
    expect(segs).toEqual([
      { text: "(shy) literal", emotion: "normal", range: { start: 0, end: 15 } },
    ]);
  });

  it("collapses empty segments between back-to-back tags", () => {
    // "(shy)(whisper)hi" — between the two tags there's no text, so we
    // only emit one segment for "hi" under the second emotion.
    const segs = parseEmotionTags("(shy)(whisper)hi");
    expect(segs).toEqual([{ text: "hi", emotion: "whisper", range: { start: 14, end: 16 } }]);
  });

  it("exposes original-message ranges (tags excluded from the text)", () => {
    const msg = "x (excited) yo";
    const segs = parseEmotionTags(msg);
    expect(segs[1]).toEqual({
      text: " yo",
      emotion: "excited",
      range: { start: 11, end: 14 },
    });
    // The original message slice of range == segment text only for
    // segments whose emotion did not change mid-span.
    expect(msg.slice(segs[1]!.range.start, segs[1]!.range.end)).toBe(" yo");
  });

  it("accepts `defaultEmotion` override for pre-tag text", () => {
    const segs = parseEmotionTags("hi (shy) there", { defaultEmotion: "dramatic" });
    expect(segs[0]!.emotion).toBe("dramatic");
    expect(segs[1]!.emotion).toBe("shy");
  });

  it("normalizes emotion names to lowercase", () => {
    const segs = parseEmotionTags("(Shy) Hi (WHISPER) yo");
    expect(segs.map((s) => s.emotion)).toEqual(["shy", "whisper"]);
  });

  it("ignores invalid tag bodies (digits-first, spaces, empty)", () => {
    // `(1bad)` → literal, `( spaced)` → literal, `()` → literal.
    const segs = parseEmotionTags("(1bad) (x y) ()");
    // Nothing parsed as a tag; single `normal` segment equal to the whole
    // message.
    expect(segs).toEqual([
      {
        text: "(1bad) (x y) ()",
        emotion: "normal",
        range: { start: 0, end: 15 },
      },
    ]);
  });
});
