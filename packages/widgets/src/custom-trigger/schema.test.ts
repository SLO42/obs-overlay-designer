import { describe, expect, it } from "vitest";
import { customTriggerSchema } from "./schema";

describe("customTriggerSchema", () => {
  it("parses `{}` to the documented top-level defaults", () => {
    const parsed = customTriggerSchema.parse({});
    expect(parsed.rules).toEqual([]);
    expect(parsed.fanOutWhenTargetsEmpty).toBe(false);
  });

  it("accepts a rule per matcher type", () => {
    const parsed = customTriggerSchema.parse({
      rules: [
        {
          id: "r1",
          enabled: true,
          matcher: { type: "chat.keyword", keyword: "hype" },
          targets: [],
          effects: [],
        },
        {
          id: "r2",
          enabled: true,
          matcher: { type: "chat.command", command: "!hype" },
          targets: [],
          effects: [],
        },
        {
          id: "r3",
          enabled: true,
          matcher: { type: "channel.redeem", rewardId: "reward-uuid" },
          targets: [],
          effects: [],
        },
        {
          id: "r4",
          enabled: true,
          matcher: { type: "channel.cheer", minBits: 100 },
          targets: [],
          effects: [],
        },
        {
          id: "r5",
          enabled: true,
          matcher: { type: "donation", minAmount: 100, currency: "USD" },
          targets: [],
          effects: [],
        },
      ],
    });
    expect(parsed.rules).toHaveLength(5);
    expect(parsed.rules[0]!.matcher.type).toBe("chat.keyword");
    expect(parsed.rules[4]!.matcher.type).toBe("donation");
  });

  it("accepts each effect type with defaults", () => {
    const parsed = customTriggerSchema.parse({
      rules: [
        {
          id: "r1",
          matcher: { type: "chat.keyword", keyword: "hype" },
          effects: [
            { id: "e1", type: "shake" },
            { id: "e2", type: "flash" },
            { id: "e3", type: "zoom-punch" },
            { id: "e4", type: "confetti" },
            { id: "e5", type: "emote-rain" },
          ],
        },
      ],
    });
    const rule = parsed.rules[0]!;
    expect(rule.effects).toHaveLength(5);
    const shake = rule.effects.find((e) => e.type === "shake")!;
    expect(shake.type).toBe("shake");
    if (shake.type === "shake") {
      expect(shake.amplitude).toBe(8);
      expect(shake.durationMs).toBe(600);
    }
    const flash = rule.effects.find((e) => e.type === "flash")!;
    if (flash.type === "flash") {
      expect(flash.color).toBe("#8b5cf6");
      expect(flash.durationMs).toBe(400);
    }
    const zoom = rule.effects.find((e) => e.type === "zoom-punch")!;
    if (zoom.type === "zoom-punch") {
      expect(zoom.scale).toBeCloseTo(1.08);
      expect(zoom.durationMs).toBe(400);
    }
    const conf = rule.effects.find((e) => e.type === "confetti")!;
    if (conf.type === "confetti") {
      expect(conf.count).toBe(40);
      expect(conf.durationMs).toBe(1400);
    }
    const rain = rule.effects.find((e) => e.type === "emote-rain")!;
    if (rain.type === "emote-rain") {
      expect(rain.durationMs).toBe(4000);
    }
  });

  it("rejects an unknown matcher type", () => {
    expect(() =>
      customTriggerSchema.parse({
        rules: [
          {
            id: "r1",
            enabled: true,
            matcher: { type: "chat.bogus" },
            targets: [],
            effects: [],
          },
        ],
      }),
    ).toThrow();
  });

  it("defaults rule.enabled to true", () => {
    const parsed = customTriggerSchema.parse({
      rules: [
        {
          id: "r1",
          matcher: { type: "chat.keyword", keyword: "hi" },
          effects: [],
        },
      ],
    });
    expect(parsed.rules[0]!.enabled).toBe(true);
  });

  it("defaults rule.targets to []", () => {
    const parsed = customTriggerSchema.parse({
      rules: [
        {
          id: "r1",
          matcher: { type: "chat.keyword", keyword: "hi" },
          effects: [],
        },
      ],
    });
    expect(parsed.rules[0]!.targets).toEqual([]);
  });

  it("defaults rule.effects to []", () => {
    const parsed = customTriggerSchema.parse({
      rules: [
        {
          id: "r1",
          matcher: { type: "chat.keyword", keyword: "hi" },
        },
      ],
    });
    expect(parsed.rules[0]!.effects).toEqual([]);
  });

  it("defaults keyword/command to '' and '!'", () => {
    const k = customTriggerSchema.parse({
      rules: [
        {
          id: "r1",
          matcher: { type: "chat.keyword" },
          effects: [],
        },
      ],
    });
    expect(k.rules[0]!.matcher.type).toBe("chat.keyword");
    if (k.rules[0]!.matcher.type === "chat.keyword") {
      expect(k.rules[0]!.matcher.keyword).toBe("");
    }

    const c = customTriggerSchema.parse({
      rules: [
        {
          id: "r2",
          matcher: { type: "chat.command" },
          effects: [],
        },
      ],
    });
    if (c.rules[0]!.matcher.type === "chat.command") {
      expect(c.rules[0]!.matcher.command).toBe("!");
    }
  });
});
