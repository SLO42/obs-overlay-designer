import { describe, expect, it } from "vitest";
import { DEFAULT_EMOTION_ANIMATIONS, speakAlertSchema } from "./schema";

describe("speakAlertSchema", () => {
  it("parses `{}` to the documented top-level defaults", () => {
    const parsed = speakAlertSchema.parse({});
    // Events
    expect(parsed.speakDonation).toBe(true);
    expect(parsed.speakCheer).toBe(false);
    expect(parsed.speakSubscribe).toBe(false);
    expect(parsed.speakFollow).toBe(false);
    expect(parsed.speakRaid).toBe(false);
    expect(parsed.speakRedeem).toBe(false);
    // Thresholds
    expect(parsed.minDonationAmount).toBe(100);
    expect(parsed.minCheerBits).toBe(100);
    // Templates
    expect(parsed.titleTemplate).toBe("{user} · {amount} {currency}");
    expect(parsed.speakTemplate).toBe("{message}");
    // TTS
    expect(parsed.ttsEnabled).toBe(true);
    expect(parsed.ttsRate).toBe(1);
    expect(parsed.ttsVolume).toBe(1);
    expect(parsed.ttsDefaultEmotion).toBe("normal");
    expect(parsed.ttsLang).toBe("en-US");
    expect(parsed.ttsVoiceName).toBe("");
    // Queue
    expect(parsed.displayMs).toBe(6_000);
    expect(parsed.spacingMs).toBe(400);
    expect(parsed.maxQueue).toBe(20);
    expect(parsed.entranceAnim).toBe("scale");
    expect(parsed.exitAnim).toBe("fade");
    // Visuals
    expect(parsed.fontFamily).toBe("display");
    expect(parsed.titleSize).toBe(28);
    expect(parsed.messageSize).toBe(20);
    expect(parsed.accentFromSource).toBe(true);
    expect(parsed.accentOverride).toBe("#8b5cf6");
    expect(parsed.cardBg).toBe("#11141bcc");
    expect(parsed.cardPadding).toBe(16);
    expect(parsed.cardRadius).toBe(10);
    expect(parsed.textShadow).toBe(true);
    // Highlight
    expect(parsed.highlightCurrentWord).toBe(true);
    expect(parsed.highlightColor).toBe("#a78bfa");
  });

  it("populates every built-in emotion animation by default", () => {
    const parsed = speakAlertSchema.parse({});
    const keys = Object.keys(parsed.emotionAnimations).sort();
    expect(keys).toEqual(
      ["normal", "shy", "whisper", "angry", "excited", "sad", "happy", "robotic"].sort(),
    );
    // Spot-check one — the angry row should be a shake at intensity 1.5.
    expect(parsed.emotionAnimations.angry).toEqual({ effect: "shake", intensity: 1.5 });
    expect(parsed.emotionAnimations.normal).toEqual({ effect: "none", intensity: 1 });
    // And the DEFAULT export matches the parsed defaults.
    expect(DEFAULT_EMOTION_ANIMATIONS.happy).toEqual({ effect: "zoom-punch", intensity: 1.1 });
  });

  it("rejects invalid accent / highlight / background colors", () => {
    // accentOverride and highlightColor only allow #rrggbb.
    expect(() => speakAlertSchema.parse({ accentOverride: "red" })).toThrow();
    expect(() => speakAlertSchema.parse({ accentOverride: "#abc" })).toThrow();
    expect(() => speakAlertSchema.parse({ accentOverride: "#11223344" })).toThrow();
    expect(() => speakAlertSchema.parse({ highlightColor: "violet" })).toThrow();
    // cardBg allows 8-char hex.
    expect(speakAlertSchema.parse({ cardBg: "#11223344" }).cardBg).toBe("#11223344");
    expect(() => speakAlertSchema.parse({ cardBg: "#abc" })).toThrow();
    // Well-formed 6-char passes.
    const ok = speakAlertSchema.parse({ accentOverride: "#abcdef" });
    expect(ok.accentOverride).toBe("#abcdef");
  });

  it("rejects negative thresholds and non-integer thresholds", () => {
    expect(() => speakAlertSchema.parse({ minDonationAmount: -1 })).toThrow();
    expect(() => speakAlertSchema.parse({ minDonationAmount: 1.5 })).toThrow();
    expect(() => speakAlertSchema.parse({ minCheerBits: -5 })).toThrow();
    expect(() => speakAlertSchema.parse({ minCheerBits: 0.1 })).toThrow();
    // Zero and positive integers pass.
    expect(speakAlertSchema.parse({ minDonationAmount: 0 }).minDonationAmount).toBe(0);
    expect(speakAlertSchema.parse({ minCheerBits: 1_000 }).minCheerBits).toBe(1_000);
  });

  it("rejects unknown entrance / exit animation values", () => {
    expect(() => speakAlertSchema.parse({ entranceAnim: "zoom" })).toThrow();
    expect(() => speakAlertSchema.parse({ exitAnim: "pop" })).toThrow();
    expect(speakAlertSchema.parse({ entranceAnim: "slide-up" }).entranceAnim).toBe("slide-up");
    expect(speakAlertSchema.parse({ exitAnim: "slide-out" }).exitAnim).toBe("slide-out");
    expect(speakAlertSchema.parse({ entranceAnim: "fade" }).entranceAnim).toBe("fade");
  });

  it("rejects out-of-range TTS rate and volume", () => {
    expect(() => speakAlertSchema.parse({ ttsRate: 0.4 })).toThrow();
    expect(() => speakAlertSchema.parse({ ttsRate: 1.7 })).toThrow();
    expect(() => speakAlertSchema.parse({ ttsVolume: -0.1 })).toThrow();
    expect(() => speakAlertSchema.parse({ ttsVolume: 1.1 })).toThrow();
    // Boundaries succeed.
    expect(speakAlertSchema.parse({ ttsRate: 0.5 }).ttsRate).toBe(0.5);
    expect(speakAlertSchema.parse({ ttsRate: 1.6 }).ttsRate).toBe(1.6);
  });

  it("rejects emotion animations outside intensity range and with bad effect values", () => {
    expect(() =>
      speakAlertSchema.parse({
        emotionAnimations: { custom: { effect: "none", intensity: 0 } },
      }),
    ).toThrow();
    expect(() =>
      speakAlertSchema.parse({
        emotionAnimations: { custom: { effect: "wobble", intensity: 1 } },
      }),
    ).toThrow();
    // Valid custom emotion parses and merges alongside defaults on the consumer side.
    const parsed = speakAlertSchema.parse({
      emotionAnimations: { custom: { effect: "flash", intensity: 2 } },
    });
    expect(parsed.emotionAnimations.custom).toEqual({ effect: "flash", intensity: 2 });
  });

  it("honours custom field overrides for layout knobs", () => {
    const parsed = speakAlertSchema.parse({
      titleSize: 48,
      messageSize: 24,
      maxQueue: 50,
      displayMs: 8_000,
      spacingMs: 0,
      highlightColor: "#112233",
    });
    expect(parsed.titleSize).toBe(48);
    expect(parsed.messageSize).toBe(24);
    expect(parsed.maxQueue).toBe(50);
    expect(parsed.displayMs).toBe(8_000);
    expect(parsed.spacingMs).toBe(0);
    expect(parsed.highlightColor).toBe("#112233");
    // Unrelated defaults are still present.
    expect(parsed.entranceAnim).toBe("scale");
    expect(parsed.ttsEnabled).toBe(true);
  });
});
