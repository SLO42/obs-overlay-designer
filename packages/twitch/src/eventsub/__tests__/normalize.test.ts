import { describe, expect, it } from "vitest";
import type { SubEvent } from "@obs/core";
import type { NotificationMessage } from "../messages";
import { normalizeNotification } from "../normalize";

function wrap(type: string, event: unknown): NotificationMessage {
  return {
    metadata: {
      message_id: "m-1",
      message_timestamp: "2024-01-01T00:00:00Z",
      message_type: "notification",
      subscription_type: type,
      subscription_version: "1",
    },
    payload: {
      subscription: {
        id: "sub-1",
        type,
        version: "1",
        status: "enabled",
        created_at: "2024-01-01T00:00:00Z",
      },
      event,
    },
  };
}

describe("normalizeNotification", () => {
  it("maps channel.chat.message with fragments + roles", () => {
    const payload = {
      broadcaster_user_id: "1",
      broadcaster_user_login: "caster",
      broadcaster_user_name: "Caster",
      chatter_user_id: "42",
      chatter_user_login: "viewer",
      chatter_user_name: "Viewer",
      message_id: "msg-1",
      message: {
        text: "hi Kappa",
        fragments: [
          { type: "text", text: "hi " },
          {
            type: "emote",
            text: "Kappa",
            emote: { id: "25", format: ["static"] },
          },
        ],
      },
      color: "#FF0000",
      badges: [
        { set_id: "moderator", id: "1" },
        { set_id: "subscriber", id: "6" },
      ],
    };
    const result = normalizeNotification(wrap("channel.chat.message", payload));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("chat.message");
    const chat = result as Extract<typeof result, { kind: "chat.message" }>;
    expect(chat.user.login).toBe("viewer");
    expect(chat.user.color).toBe("#FF0000");
    expect(chat.user.roles).toEqual(["mod", "subscriber"]);
    expect(chat.fragments).toHaveLength(2);
    expect(chat.fragments[1]!.type).toBe("emote");
    expect(chat.fragments[1]!.emoteId).toBe("25");
    expect(chat.fragments[1]!.emoteUrl).toContain("/v2/25/");
    expect(chat.plain).toBe("hi Kappa");
  });

  it("maps channel.cheer (anonymous)", () => {
    const payload = {
      is_anonymous: true,
      user_id: null,
      user_login: null,
      user_name: null,
      broadcaster_user_id: "1",
      broadcaster_user_login: "c",
      broadcaster_user_name: "C",
      message: "cheer100!",
      bits: 100,
    };
    const result = normalizeNotification(wrap("channel.cheer", payload));
    expect(result!.kind).toBe("channel.cheer");
    const cheer = result as Extract<typeof result, { kind: "channel.cheer" }>;
    expect(cheer.user).toBeNull();
    expect(cheer.bits).toBe(100);
  });

  it("maps channel.subscribe", () => {
    const payload = {
      user_id: "42",
      user_login: "viewer",
      user_name: "Viewer",
      broadcaster_user_id: "1",
      broadcaster_user_login: "c",
      broadcaster_user_name: "C",
      tier: "2000",
      is_gift: false,
    };
    const result = normalizeNotification(wrap("channel.subscribe", payload));
    expect(result!.kind).toBe("channel.subscribe");
    const sub = result as SubEvent;
    expect(sub.tier).toBe("2000");
    expect(sub.isGift).toBe(false);
    expect(sub.user.login).toBe("viewer");
  });

  it("maps channel.subscription.gift", () => {
    const payload = {
      user_id: "42",
      user_login: "viewer",
      user_name: "Viewer",
      broadcaster_user_id: "1",
      tier: "1000",
      total: 3,
      cumulative_total: 10,
      is_anonymous: false,
    };
    const result = normalizeNotification(wrap("channel.subscription.gift", payload));
    expect(result!.kind).toBe("channel.subscription.gift");
    const gift = result as SubEvent;
    expect(gift.isGift).toBe(true);
    expect(gift.cumulativeMonths).toBe(10);
  });

  it("maps channel.follow v2", () => {
    const payload = {
      user_id: "42",
      user_login: "viewer",
      user_name: "Viewer",
      broadcaster_user_id: "1",
      followed_at: "2024-01-01T00:00:00Z",
    };
    const result = normalizeNotification(wrap("channel.follow", payload));
    expect(result!.kind).toBe("channel.follow");
  });

  it("maps channel.raid", () => {
    const payload = {
      from_broadcaster_user_id: "99",
      from_broadcaster_user_login: "raider",
      from_broadcaster_user_name: "Raider",
      to_broadcaster_user_id: "1",
      viewers: 250,
    };
    const result = normalizeNotification(wrap("channel.raid", payload));
    expect(result!.kind).toBe("channel.raid");
    const raid = result as Extract<typeof result, { kind: "channel.raid" }>;
    expect(raid.viewers).toBe(250);
    expect(raid.from.login).toBe("raider");
  });

  it("maps channel_points redemption", () => {
    const payload = {
      id: "redeem-1",
      user_id: "42",
      user_login: "viewer",
      user_name: "Viewer",
      user_input: "typed this",
      reward: { id: "reward-1", title: "Hydrate" },
    };
    const result = normalizeNotification(
      wrap("channel.channel_points_custom_reward_redemption.add", payload),
    );
    expect(result!.kind).toBe("channel.channel_points_custom_reward_redemption.add");
    const r = result as Extract<
      typeof result,
      { kind: "channel.channel_points_custom_reward_redemption.add" }
    >;
    expect(r.rewardId).toBe("reward-1");
    expect(r.rewardTitle).toBe("Hydrate");
    expect(r.userInput).toBe("typed this");
  });

  it("returns null for unknown subscription types", () => {
    const result = normalizeNotification(wrap("channel.future_thing", {}));
    expect(result).toBeNull();
  });
});
