import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEventBus,
  OverlayBusProvider,
  type EventBus,
  type RedeemEvent,
  type StreamEvent,
  type Widget,
} from "@obs/core";
import { createWidget } from "../registry";
// Importing the barrel registers the channel-point-alert kind.
import "../index";
import { channelPointAlertSchema, type ChannelPointAlertProps } from "./schema";
import { ChannelPointAlertRuntime } from "./Runtime";

function makeRedeem(over: Partial<RedeemEvent> = {}): RedeemEvent {
  return {
    kind: "channel.channel_points_custom_reward_redemption.add",
    id: over.id ?? "r1",
    user: over.user ?? { id: "u1", login: "alice", displayName: "Alice" },
    rewardId: over.rewardId ?? "reward-123",
    rewardTitle: over.rewardTitle ?? "Big Drink",
    userInput: over.userInput,
    receivedAt: over.receivedAt ?? Date.parse("2024-01-01T00:00:00Z"),
  };
}

function makeProps(partial: Partial<Record<keyof ChannelPointAlertProps, unknown>> = {}) {
  return channelPointAlertSchema.parse(partial);
}

function renderWithBus(
  partial: Partial<Record<keyof ChannelPointAlertProps, unknown>>,
  bus: EventBus<StreamEvent>,
) {
  const widget = createWidget("channel-point-alert", {
    props: makeProps(partial),
  }) as Widget<ChannelPointAlertProps>;
  const result = render(
    <OverlayBusProvider bus={bus}>
      <ChannelPointAlertRuntime widget={widget} />
    </OverlayBusProvider>,
  );
  return { ...result, widget };
}

function renderNoBus(partial: Partial<Record<keyof ChannelPointAlertProps, unknown>> = {}) {
  const widget = createWidget("channel-point-alert", {
    props: makeProps(partial),
  }) as Widget<ChannelPointAlertProps>;
  return render(<ChannelPointAlertRuntime widget={widget} />);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ChannelPointAlertRuntime — filtering", () => {
  it("only enqueues redemptions with a matching rewardId", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ rewardId: "reward-match" }, bus);

    act(() => {
      bus.emit(makeRedeem({ id: "nope", rewardId: "reward-other" }));
    });
    expect(container.querySelector("[data-alert-title]")).toBeNull();

    act(() => {
      bus.emit(makeRedeem({ id: "yep", rewardId: "reward-match", rewardTitle: "Win" }));
    });
    const title = container.querySelector("[data-alert-title]");
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe("Alice redeemed Win");
  });

  it("with empty rewardId, matches by rewardTitleContains (case-insensitive)", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ rewardTitleContains: "hydrate" }, bus);

    act(() => {
      bus.emit(makeRedeem({ id: "n", rewardTitle: "Ad Skip" }));
    });
    expect(container.querySelector("[data-alert-title]")).toBeNull();

    act(() => {
      bus.emit(makeRedeem({ id: "y", rewardTitle: "Please HYDRATE now" }));
    });
    const title = container.querySelector("[data-alert-title]");
    expect(title!.textContent).toBe("Alice redeemed Please HYDRATE now");
  });

  it("with both filters empty, enqueues any redemption", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);

    act(() => {
      bus.emit(makeRedeem({ id: "any", rewardId: "anything", rewardTitle: "Anything" }));
    });
    const title = container.querySelector("[data-alert-title]");
    expect(title!.textContent).toBe("Alice redeemed Anything");
  });
});

describe("ChannelPointAlertRuntime — interpolation", () => {
  it("substitutes {user}, {rewardTitle}, and {userInput}", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus(
      {
        title: "{user} - {rewardTitle}",
        subtitle: "input: {userInput}",
      },
      bus,
    );

    act(() => {
      bus.emit(
        makeRedeem({
          user: { id: "u", login: "zed", displayName: "Zed" },
          rewardTitle: "Hydrate",
          userInput: "drink some water",
        }),
      );
    });

    expect(container.querySelector("[data-alert-title]")!.textContent).toBe("Zed - Hydrate");
    expect(container.querySelector("[data-alert-subtitle]")!.textContent).toBe(
      "input: drink some water",
    );
  });

  it("hideEmptySubtitle + empty userInput: subtitle node is absent", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ hideEmptySubtitle: true }, bus);

    act(() => {
      bus.emit(makeRedeem({ userInput: undefined }));
    });

    expect(container.querySelector("[data-alert-title]")).not.toBeNull();
    expect(container.querySelector("[data-alert-subtitle]")).toBeNull();
  });

  it("hideEmptySubtitle=false: subtitle node renders even with empty userInput", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ hideEmptySubtitle: false }, bus);

    act(() => {
      bus.emit(makeRedeem({ userInput: undefined }));
    });

    expect(container.querySelector("[data-alert-subtitle]")).not.toBeNull();
  });
});

describe("ChannelPointAlertRuntime — queue", () => {
  it("clears the current alert after displayMs + exit animation", () => {
    vi.useFakeTimers();
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ displayMs: 1_000, spacingMs: 0 }, bus);

    act(() => {
      bus.emit(makeRedeem());
    });
    expect(container.querySelector("[data-alert-title]")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    const card = container.querySelector("[data-alert-kind]") as HTMLElement | null;
    expect(card?.getAttribute("data-state")).toBe("out");

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(container.querySelector("[data-alert-title]")).toBeNull();
  });

  it("drops the oldest entries when maxQueue overflows", () => {
    vi.useFakeTimers();
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus(
      {
        displayMs: 30_000, // hold current card so the queue accumulates
        spacingMs: 0,
        maxQueue: 2,
      },
      bus,
    );

    act(() => {
      bus.emit(makeRedeem({ id: "current", rewardTitle: "CURRENT" }));
    });
    act(() => {
      bus.emit(makeRedeem({ id: "q1", rewardTitle: "Q1" }));
      bus.emit(makeRedeem({ id: "q2", rewardTitle: "Q2" }));
      bus.emit(makeRedeem({ id: "q3", rewardTitle: "Q3" }));
      bus.emit(makeRedeem({ id: "q4", rewardTitle: "Q4" }));
    });

    // The current card is still the original — it's held for 30s.
    expect(container.querySelector("[data-alert-title]")!.textContent).toBe(
      "Alice redeemed CURRENT",
    );

    // Drain. maxQueue=2 → q1/q2 dropped, queue tail is [q3, q4].
    act(() => {
      vi.advanceTimersByTime(30_000 + 400);
    });
    expect(container.querySelector("[data-alert-title]")!.textContent).toBe("Alice redeemed Q3");
  });
});

describe("ChannelPointAlertRuntime — design mode", () => {
  it("renders a preview card with the 'Preview' label when no provider wraps it", () => {
    const { container } = renderNoBus();
    const preview = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "Preview",
    );
    expect(preview).not.toBeUndefined();

    const title = container.querySelector("[data-alert-title]");
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe("Preview redeemed Sample reward");
    // No `data-state` — design mode doesn't trigger the animation keyframes.
    const card = container.querySelector("[data-alert-kind]") as HTMLElement;
    expect(card.getAttribute("data-state")).toBe(null);
  });
});
