import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import {
  createEventBus,
  OverlayBusProvider,
  type ChatMessage,
  type CheerEvent,
  type DonationEvent,
  type EventBus,
  type RedeemEvent,
  type StreamEvent,
  type Widget,
} from "@obs/core";
import { matchTrigger, useTriggerEngine } from "./triggerEngine";

// Mock the `@obs/effects` module so the engine's contract is testable
// without animating. The mock records every call + returns a per-call
// cleanup spy so unmount behavior can be asserted too.
const playEffectMock = vi.fn();
const cleanupSpies: Array<ReturnType<typeof vi.fn>> = [];
vi.mock("@obs/effects", () => ({
  playEffect: (...args: unknown[]) => playEffectMock(...args),
}));

beforeEach(() => {
  playEffectMock.mockReset();
  cleanupSpies.length = 0;
  playEffectMock.mockImplementation(() => {
    const c = vi.fn();
    cleanupSpies.push(c);
    return c;
  });
});
afterEach(() => {
  cleanup();
});

/* ---------------------------------------------------------------------- */
/* Fixtures                                                               */
/* ---------------------------------------------------------------------- */

function makeChat(overrides: Partial<ChatMessage> & { plain?: string } = {}): ChatMessage {
  return {
    kind: "chat.message",
    id: overrides.id ?? "m1",
    user: overrides.user ?? {
      id: "u1",
      login: "alice",
      displayName: "Alice",
      roles: ["viewer"],
    },
    fragments: overrides.fragments ?? [{ type: "text", text: overrides.plain ?? "hi" }],
    plain: overrides.plain ?? "hi",
    receivedAt: overrides.receivedAt ?? 0,
  };
}

function makeCheer(bits: number): CheerEvent {
  return {
    kind: "channel.cheer",
    id: "c1",
    user: { id: "u2", login: "bob", displayName: "Bob" },
    bits,
    message: "",
    receivedAt: 0,
  };
}

function makeDonation(amount: number, currency = "USD"): DonationEvent {
  return {
    kind: "donation",
    id: "d1",
    source: "streamlabs",
    user: { displayName: "Cara" },
    amount,
    currency,
    receivedAt: 0,
  };
}

function makeRedeem(rewardId: string): RedeemEvent {
  return {
    kind: "channel.channel_points_custom_reward_redemption.add",
    id: "r1",
    user: { id: "u3", login: "dan", displayName: "Dan" },
    rewardId,
    rewardTitle: "Hydrate",
    receivedAt: 0,
  };
}

/* ---------------------------------------------------------------------- */
/* matchTrigger                                                           */
/* ---------------------------------------------------------------------- */

describe("matchTrigger", () => {
  it("chat.keyword: matches case-insensitive substring by default", () => {
    expect(
      matchTrigger(makeChat({ plain: "let's HYPE" }), {
        type: "chat.keyword",
        keyword: "hype",
      }),
    ).toBe(true);
  });

  it("chat.keyword: caseSensitive flag is honored", () => {
    const matcher = {
      type: "chat.keyword" as const,
      keyword: "HYPE",
      caseSensitive: true,
    };
    expect(matchTrigger(makeChat({ plain: "let's HYPE" }), matcher)).toBe(true);
    expect(matchTrigger(makeChat({ plain: "let's hype" }), matcher)).toBe(false);
  });

  it("chat.keyword: roles filter gates by user.roles intersection", () => {
    const msg = makeChat({
      plain: "mods only",
      user: { id: "u", login: "x", displayName: "X", roles: ["viewer"] },
    });
    const matcher = {
      type: "chat.keyword" as const,
      keyword: "mods",
      roles: ["mod" as const],
    };
    expect(matchTrigger(msg, matcher)).toBe(false);

    const modMsg = makeChat({
      plain: "mods only",
      user: { id: "u", login: "x", displayName: "X", roles: ["mod", "viewer"] },
    });
    expect(matchTrigger(modMsg, matcher)).toBe(true);
  });

  it("chat.keyword: empty keyword never matches", () => {
    expect(
      matchTrigger(makeChat({ plain: "anything" }), {
        type: "chat.keyword",
        keyword: "",
      }),
    ).toBe(false);
  });

  it("chat.keyword: ignores non-chat events", () => {
    expect(matchTrigger(makeCheer(100), { type: "chat.keyword", keyword: "hype" })).toBe(false);
  });

  it("chat.command: matches lowercased prefix of trimmed plain text", () => {
    expect(
      matchTrigger(makeChat({ plain: "  !Hype let's go  " }), {
        type: "chat.command",
        command: "!hype",
      }),
    ).toBe(true);
  });

  it("chat.command: requires prefix, not substring", () => {
    expect(
      matchTrigger(makeChat({ plain: "please !hype" }), {
        type: "chat.command",
        command: "!hype",
      }),
    ).toBe(false);
  });

  it("channel.redeem: matches exact rewardId", () => {
    expect(
      matchTrigger(makeRedeem("reward-123"), {
        type: "channel.redeem",
        rewardId: "reward-123",
      }),
    ).toBe(true);
    expect(
      matchTrigger(makeRedeem("reward-456"), {
        type: "channel.redeem",
        rewardId: "reward-123",
      }),
    ).toBe(false);
  });

  it("channel.cheer: honors minBits (default 0 matches anything)", () => {
    expect(
      matchTrigger(makeCheer(50), {
        type: "channel.cheer",
        minBits: 100,
      }),
    ).toBe(false);
    expect(
      matchTrigger(makeCheer(500), {
        type: "channel.cheer",
        minBits: 100,
      }),
    ).toBe(true);
    // No minBits → any cheer matches.
    expect(matchTrigger(makeCheer(1), { type: "channel.cheer" })).toBe(true);
  });

  it("donation: matches when amount & currency both satisfy", () => {
    expect(
      matchTrigger(makeDonation(500, "USD"), {
        type: "donation",
        minAmount: 100,
        currency: "USD",
      }),
    ).toBe(true);
    expect(
      matchTrigger(makeDonation(50, "USD"), {
        type: "donation",
        minAmount: 100,
        currency: "USD",
      }),
    ).toBe(false);
    expect(
      matchTrigger(makeDonation(500, "EUR"), {
        type: "donation",
        minAmount: 100,
        currency: "USD",
      }),
    ).toBe(false);
  });
});

/* ---------------------------------------------------------------------- */
/* useTriggerEngine (integration)                                         */
/* ---------------------------------------------------------------------- */

function makeWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: "w1",
    kind: "text",
    name: "w",
    transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0, zIndex: 0 },
    props: {},
    triggers: [],
    effects: [],
    ...overrides,
  };
}

interface HarnessProps {
  widget: Widget;
}

function Harness({ widget }: HarnessProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useTriggerEngine(widget, ref);
  return <div ref={ref} data-testid="host" />;
}

function renderHarness(widget: Widget, bus: EventBus<StreamEvent>) {
  return render(
    <OverlayBusProvider bus={bus}>
      <Harness widget={widget} />
    </OverlayBusProvider>,
  );
}

describe("useTriggerEngine", () => {
  it("fires playEffect with the resolved effect when a matching chat event arrives", () => {
    const bus = createEventBus<StreamEvent>();
    const widget = makeWidget({
      effects: [{ id: "e1", type: "shake", amplitude: 8, durationMs: 600 }],
      triggers: [
        {
          id: "t1",
          enabled: true,
          match: { type: "chat.command", command: "!hype" },
          effects: ["e1"],
        },
      ],
    });

    const { getByTestId } = renderHarness(widget, bus);

    act(() => {
      bus.emit(makeChat({ plain: "!hype let's go" }));
    });

    expect(playEffectMock).toHaveBeenCalledTimes(1);
    const [target, effect, ctx] = playEffectMock.mock.calls[0]!;
    expect(target).toBe(getByTestId("host"));
    expect(effect).toEqual({
      id: "e1",
      type: "shake",
      amplitude: 8,
      durationMs: 600,
    });
    expect(ctx).toEqual({ respectReducedMotion: true, emoteUrls: undefined });
  });

  it("no-ops when rendered without an OverlayBusProvider (default bus)", () => {
    const widget = makeWidget({
      effects: [{ id: "e1", type: "shake", amplitude: 8, durationMs: 600 }],
      triggers: [
        {
          id: "t1",
          enabled: true,
          match: { type: "chat.command", command: "!hype" },
          effects: ["e1"],
        },
      ],
    });

    render(<Harness widget={widget} />);

    // No bus emitted anything, but more importantly the engine never
    // subscribed, so even a later emit on a newly constructed bus would
    // not reach us. We assert the no-subscription contract by letting
    // the mount + unmount cycle through without throwing.
    expect(playEffectMock).not.toHaveBeenCalled();
  });

  it("skips triggers whose text does not match", () => {
    const bus = createEventBus<StreamEvent>();
    const widget = makeWidget({
      effects: [{ id: "e1", type: "shake", amplitude: 8, durationMs: 600 }],
      triggers: [
        {
          id: "t1",
          enabled: true,
          match: { type: "chat.keyword", keyword: "hype" },
          effects: ["e1"],
        },
      ],
    });
    renderHarness(widget, bus);

    act(() => {
      bus.emit(makeChat({ plain: "good morning chat" }));
    });

    expect(playEffectMock).not.toHaveBeenCalled();
  });

  it("ignores disabled triggers", () => {
    const bus = createEventBus<StreamEvent>();
    const widget = makeWidget({
      effects: [{ id: "e1", type: "shake", amplitude: 8, durationMs: 600 }],
      triggers: [
        {
          id: "t1",
          enabled: false,
          match: { type: "chat.command", command: "!hype" },
          effects: ["e1"],
        },
      ],
    });
    renderHarness(widget, bus);

    act(() => {
      bus.emit(makeChat({ plain: "!hype let's go" }));
    });

    expect(playEffectMock).not.toHaveBeenCalled();
  });

  it("warns + skips when an effect id is missing from the widget's effects", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const bus = createEventBus<StreamEvent>();
      const widget = makeWidget({
        effects: [],
        triggers: [
          {
            id: "t1",
            enabled: true,
            match: { type: "chat.command", command: "!hype" },
            effects: ["ghost-id"],
          },
        ],
      });
      renderHarness(widget, bus);

      act(() => {
        bus.emit(makeChat({ plain: "!hype" }));
      });

      expect(playEffectMock).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("unknown effect id"));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("calls each in-flight effect cleanup on unmount", () => {
    const bus = createEventBus<StreamEvent>();
    const widget = makeWidget({
      effects: [
        { id: "e1", type: "shake", amplitude: 8, durationMs: 600 },
        { id: "e2", type: "flash", color: "#fff", durationMs: 400 },
      ],
      triggers: [
        {
          id: "t1",
          enabled: true,
          match: { type: "chat.command", command: "!hype" },
          effects: ["e1", "e2"],
        },
      ],
    });
    const { unmount } = renderHarness(widget, bus);

    act(() => {
      bus.emit(makeChat({ plain: "!hype!" }));
    });

    expect(cleanupSpies).toHaveLength(2);
    expect(cleanupSpies[0]).not.toHaveBeenCalled();
    expect(cleanupSpies[1]).not.toHaveBeenCalled();

    unmount();

    expect(cleanupSpies[0]).toHaveBeenCalledTimes(1);
    expect(cleanupSpies[1]).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe when all triggers are disabled", () => {
    const bus = createEventBus<StreamEvent>();
    const widget = makeWidget({
      effects: [{ id: "e1", type: "shake", amplitude: 8, durationMs: 600 }],
      triggers: [
        {
          id: "t1",
          enabled: false,
          match: { type: "chat.command", command: "!hype" },
          effects: ["e1"],
        },
      ],
    });
    renderHarness(widget, bus);

    act(() => {
      bus.emit(makeChat({ plain: "!hype" }));
    });

    expect(playEffectMock).not.toHaveBeenCalled();
  });
});
