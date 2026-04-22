import { describe, expect, it } from "vitest";
import type {
  ChatMessage,
  CheerEvent,
  DonationEvent,
  FollowEvent,
  RaidEvent,
  RedeemEvent,
  SubEvent,
} from "@obs/core";
import { alertBoxSchema } from "./schema";
import {
  buildPlaceholders,
  countParts,
  eventKindToAlertKind,
  interpolate,
  passesThreshold,
  resolveAlert,
  tierLabel,
} from "./templates";

/** Minimal `FollowEvent` factory. */
function follow(over: Partial<FollowEvent> = {}): FollowEvent {
  return {
    kind: "channel.follow",
    id: over.id ?? "f1",
    user: over.user ?? { id: "u1", login: "alice", displayName: "Alice" },
    receivedAt: over.receivedAt ?? 1_700_000_000_000,
  };
}

function sub(over: Partial<SubEvent> = {}): SubEvent {
  return {
    kind: "channel.subscribe",
    id: over.id ?? "s1",
    user: over.user ?? { id: "u1", login: "alice", displayName: "Alice" },
    tier: over.tier ?? "1000",
    isGift: over.isGift ?? false,
    cumulativeMonths: over.cumulativeMonths,
    receivedAt: over.receivedAt ?? 1_700_000_000_000,
  };
}

function cheer(over: Partial<CheerEvent> = {}): CheerEvent {
  return {
    kind: "channel.cheer",
    id: over.id ?? "c1",
    user: over.user === undefined ? { id: "u1", login: "alice", displayName: "Alice" } : over.user,
    bits: over.bits ?? 100,
    message: over.message ?? "woo",
    receivedAt: over.receivedAt ?? 1_700_000_000_000,
  };
}

function raid(over: Partial<RaidEvent> = {}): RaidEvent {
  return {
    kind: "channel.raid",
    id: over.id ?? "r1",
    from: over.from ?? { id: "u2", login: "bob", displayName: "Bob" },
    viewers: over.viewers ?? 50,
    receivedAt: over.receivedAt ?? 1_700_000_000_000,
  };
}

function donation(over: Partial<DonationEvent> = {}): DonationEvent {
  return {
    kind: "donation",
    id: over.id ?? "d1",
    source: over.source ?? "streamlabs",
    user: over.user === undefined ? { displayName: "Carol", login: "carol" } : over.user,
    amount: over.amount ?? 500,
    currency: over.currency ?? "USD",
    message: over.message,
    receivedAt: over.receivedAt ?? 1_700_000_000_000,
  };
}

function redeem(over: Partial<RedeemEvent> = {}): RedeemEvent {
  return {
    kind: "channel.channel_points_custom_reward_redemption.add",
    id: over.id ?? "rd1",
    user: over.user ?? { id: "u1", login: "alice", displayName: "Alice" },
    rewardId: over.rewardId ?? "rw1",
    rewardTitle: over.rewardTitle ?? "Hydrate!",
    userInput: over.userInput,
    receivedAt: over.receivedAt ?? 1_700_000_000_000,
  };
}

function chat(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    kind: "chat.message",
    id: over.id ?? "m1",
    user: over.user ?? { id: "u1", login: "alice", displayName: "Alice", roles: ["viewer"] },
    fragments: over.fragments ?? [{ type: "text", text: "hi" }],
    plain: over.plain ?? "hi",
    receivedAt: over.receivedAt ?? 1_700_000_000_000,
  };
}

describe("interpolate", () => {
  it("replaces {key} with the placeholder's string value", () => {
    const p = buildPlaceholders(donation({ amount: 1_000, currency: "USD" }));
    expect(interpolate("{user} tipped {amount} {currency}", p)).toBe("Carol tipped 10.00 USD");
  });

  it("collapses unknown keys to empty string", () => {
    const p = buildPlaceholders(follow());
    expect(interpolate("{user} vs {nothere}", p)).toBe("Alice vs ");
  });

  it("leaves literal text without placeholders untouched", () => {
    const p = buildPlaceholders(follow());
    expect(interpolate("Welcome to the stream", p)).toBe("Welcome to the stream");
  });

  it("does not re-interpolate nested placeholders in resolved values", () => {
    // Craft a placeholder map where `user` *contains* a literal `{bits}`.
    const p = buildPlaceholders(follow());
    p.user = "{bits}trickster";
    p.bits = "9999";
    expect(interpolate("hello {user}", p)).toBe("hello {bits}trickster");
  });
});

describe("buildPlaceholders", () => {
  it("extracts follow events into user/login/displayName only", () => {
    const p = buildPlaceholders(follow());
    expect(p.user).toBe("Alice");
    expect(p.login).toBe("alice");
    expect(p.displayName).toBe("Alice");
    expect(p.bits).toBe("");
  });

  it("extracts sub events with tier + tierLabel", () => {
    const p = buildPlaceholders(sub({ tier: "2000" }));
    expect(p.tier).toBe("2000");
    expect(p.tierLabel).toBe("2");
    expect(p.count).toBe("1");
    expect(p.countPlural).toBe("");
  });

  it("extracts cheer events with bits + amount + BITS currency + message", () => {
    const p = buildPlaceholders(cheer({ bits: 500, message: "pog" }));
    expect(p.bits).toBe("500");
    expect(p.amount).toBe("500");
    expect(p.currency).toBe("BITS");
    expect(p.message).toBe("pog");
  });

  it("extracts raid events with from + viewers", () => {
    const p = buildPlaceholders(raid({ viewers: 123 }));
    expect(p.viewers).toBe("123");
    expect(p.from).toBe("Bob");
  });

  it("extracts donation events and formats minor-units to major-units", () => {
    const p = buildPlaceholders(donation({ amount: 1234, currency: "EUR" }));
    expect(p.amount).toBe("12.34");
    expect(p.currency).toBe("EUR");
  });

  it("handles anonymous cheers / donations with null user", () => {
    const p = buildPlaceholders(cheer({ user: null, bits: 10 }));
    expect(p.user).toBe("Anonymous");
    expect(p.login).toBe("");
    const pd = buildPlaceholders(donation({ user: null }));
    expect(pd.user).toBe("Anonymous");
  });

  it("extracts redemption events into rewardTitle + userInput", () => {
    const p = buildPlaceholders(redeem({ rewardTitle: "Choose a game", userInput: "Celeste" }));
    expect(p.rewardTitle).toBe("Choose a game");
    expect(p.userInput).toBe("Celeste");
  });

  it("extracts chat messages into message + user", () => {
    const p = buildPlaceholders(chat({ plain: "hello world" }));
    expect(p.user).toBe("Alice");
    expect(p.message).toBe("hello world");
  });
});

describe("tierLabel", () => {
  it("maps the three standard Twitch tiers", () => {
    expect(tierLabel("1000")).toBe("1");
    expect(tierLabel("2000")).toBe("2");
    expect(tierLabel("3000")).toBe("3");
  });

  it("passes unknown values through unchanged", () => {
    expect(tierLabel("Prime")).toBe("Prime");
    expect(tierLabel("custom")).toBe("custom");
  });
});

describe("countParts", () => {
  it("pluralizes counts above 1 with 's'", () => {
    expect(countParts(1)).toEqual({ count: "1", countPlural: "" });
    expect(countParts(2)).toEqual({ count: "2", countPlural: "s" });
    expect(countParts(0)).toEqual({ count: "0", countPlural: "s" });
  });
});

describe("passesThreshold", () => {
  it("is a no-op when threshold is 0", () => {
    expect(passesThreshold("cheer", cheer({ bits: 1 }), 0)).toBe(true);
    expect(passesThreshold("donation", donation({ amount: 1 }), 0)).toBe(true);
  });

  it("gates cheer on bits", () => {
    expect(passesThreshold("cheer", cheer({ bits: 499 }), 500)).toBe(false);
    expect(passesThreshold("cheer", cheer({ bits: 500 }), 500)).toBe(true);
  });

  it("gates raid on viewers", () => {
    expect(passesThreshold("raid", raid({ viewers: 9 }), 10)).toBe(false);
    expect(passesThreshold("raid", raid({ viewers: 10 }), 10)).toBe(true);
  });

  it("gates donation on amount", () => {
    expect(passesThreshold("donation", donation({ amount: 499 }), 500)).toBe(false);
    expect(passesThreshold("donation", donation({ amount: 500 }), 500)).toBe(true);
  });

  it("ignores threshold for follow / subscribe", () => {
    expect(passesThreshold("follow", follow(), 9999)).toBe(true);
    expect(passesThreshold("subscribe", sub(), 9999)).toBe(true);
  });
});

describe("eventKindToAlertKind", () => {
  it("routes channel.subscribe with isGift=true to subGift", () => {
    expect(eventKindToAlertKind(sub({ isGift: true }))).toBe("subGift");
  });

  it("routes channel.subscribe with isGift=false to subscribe", () => {
    expect(eventKindToAlertKind(sub({ isGift: false }))).toBe("subscribe");
  });

  it("routes channel.subscription.gift directly to subGift", () => {
    const giftEvent: SubEvent = { ...sub({ isGift: true }), kind: "channel.subscription.gift" };
    expect(eventKindToAlertKind(giftEvent)).toBe("subGift");
  });

  it("routes follow/cheer/raid/donation to matching kinds", () => {
    expect(eventKindToAlertKind(follow())).toBe("follow");
    expect(eventKindToAlertKind(cheer())).toBe("cheer");
    expect(eventKindToAlertKind(raid())).toBe("raid");
    expect(eventKindToAlertKind(donation())).toBe("donation");
  });

  it("returns null for events AlertBox doesn't handle (chat, redeem)", () => {
    expect(eventKindToAlertKind(chat())).toBeNull();
    expect(eventKindToAlertKind(redeem())).toBeNull();
  });
});

describe("resolveAlert", () => {
  const defaults = () => alertBoxSchema.parse({});

  it("renders the follow template with the interpolated user", () => {
    const r = resolveAlert(follow(), defaults());
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("follow");
    expect(r!.title).toBe("New follower!");
    expect(r!.subtitle).toBe("Alice");
    expect(r!.accent).toBe("#4ade80");
  });

  it("renders the subscribe template with tier label", () => {
    const r = resolveAlert(sub({ tier: "3000" }), defaults());
    expect(r!.kind).toBe("subscribe");
    expect(r!.title).toBe("New subscriber!");
    expect(r!.subtitle).toBe("Alice subscribed at Tier 3");
  });

  it("routes isGift: true to subGift and renders count=1 with no plural", () => {
    const r = resolveAlert(sub({ isGift: true }), defaults());
    expect(r!.kind).toBe("subGift");
    expect(r!.title).toBe("Gift sub!");
    expect(r!.subtitle).toBe("Alice gifted 1 sub");
  });

  it("renders the cheer template with bits", () => {
    const r = resolveAlert(cheer({ bits: 200, message: "hype" }), defaults());
    expect(r!.kind).toBe("cheer");
    expect(r!.title).toBe("200 bits!");
    expect(r!.subtitle).toBe("Alice · hype");
  });

  it("returns null when threshold gates the event out", () => {
    const widget = defaults();
    widget.cheer.threshold = 1000;
    const r = resolveAlert(cheer({ bits: 500 }), widget);
    expect(r).toBeNull();
  });

  it("returns null when the template is disabled", () => {
    const widget = defaults();
    widget.follow.enabled = false;
    expect(resolveAlert(follow(), widget)).toBeNull();
  });

  it("returns null for events AlertBox doesn't handle", () => {
    expect(resolveAlert(chat(), defaults())).toBeNull();
    expect(resolveAlert(redeem(), defaults())).toBeNull();
  });

  it("resolves donation events with major-units amount + currency", () => {
    const r = resolveAlert(donation({ amount: 2_500, currency: "USD" }), defaults());
    expect(r!.kind).toBe("donation");
    expect(r!.title).toBe("25.00 USD!");
    expect(r!.subtitle).toBe("Carol · ");
  });

  it("resolves raid events with from + viewers", () => {
    const r = resolveAlert(raid({ viewers: 42 }), defaults());
    expect(r!.kind).toBe("raid");
    expect(r!.title).toBe("Raid from Bob!");
    expect(r!.subtitle).toBe("42 incoming");
  });
});
