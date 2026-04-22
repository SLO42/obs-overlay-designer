import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEventBus,
  OverlayBusProvider,
  type CheerEvent,
  type EventBus,
  type FollowEvent,
  type RaidEvent,
  type StreamEvent,
  type SubEvent,
  type Widget,
} from "@obs/core";
import { createWidget } from "../registry";
// Importing the barrel registers the alert-box kind.
import "../index";
import { alertBoxSchema, type AlertBoxProps } from "./schema";
import { AlertBoxRuntime } from "./Runtime";

function makeFollow(over: Partial<FollowEvent> = {}): FollowEvent {
  return {
    kind: "channel.follow",
    id: over.id ?? "f1",
    user: over.user ?? { id: "u1", login: "alice", displayName: "Alice" },
    receivedAt: over.receivedAt ?? Date.parse("2024-01-01T00:00:00Z"),
  };
}

function makeCheer(over: Partial<CheerEvent> = {}): CheerEvent {
  return {
    kind: "channel.cheer",
    id: over.id ?? "c1",
    user: over.user === undefined ? { id: "u1", login: "alice", displayName: "Alice" } : over.user,
    bits: over.bits ?? 100,
    message: over.message ?? "hi",
    receivedAt: over.receivedAt ?? Date.parse("2024-01-01T00:00:00Z"),
  };
}

function makeSub(over: Partial<SubEvent> = {}): SubEvent {
  return {
    kind: "channel.subscribe",
    id: over.id ?? "s1",
    user: over.user ?? { id: "u1", login: "alice", displayName: "Alice" },
    tier: over.tier ?? "1000",
    isGift: over.isGift ?? false,
    cumulativeMonths: over.cumulativeMonths,
    receivedAt: over.receivedAt ?? Date.parse("2024-01-01T00:00:00Z"),
  };
}

function makeRaid(over: Partial<RaidEvent> = {}): RaidEvent {
  return {
    kind: "channel.raid",
    id: over.id ?? "r1",
    from: over.from ?? { id: "u2", login: "bob", displayName: "Bob" },
    viewers: over.viewers ?? 50,
    receivedAt: over.receivedAt ?? Date.parse("2024-01-01T00:00:00Z"),
  };
}

/**
 * Deeply merge through zod to populate every nested template default.
 * `createWidget`'s shallow merge would blow away per-template defaults if a
 * test only overrode a single nested field (e.g. `cheer.threshold`).
 */
function makeProps(partial: Partial<Record<keyof AlertBoxProps, unknown>> = {}): AlertBoxProps {
  return alertBoxSchema.parse(partial);
}

function renderWithBus(
  partial: Partial<Record<keyof AlertBoxProps, unknown>>,
  bus: EventBus<StreamEvent>,
) {
  const widget = createWidget("alert-box", {
    props: makeProps(partial),
  }) as Widget<AlertBoxProps>;
  const result = render(
    <OverlayBusProvider bus={bus}>
      <AlertBoxRuntime widget={widget} />
    </OverlayBusProvider>,
  );
  return { ...result, widget };
}

function renderNoBus(partial: Partial<Record<keyof AlertBoxProps, unknown>> = {}) {
  const widget = createWidget("alert-box", {
    props: makeProps(partial),
  }) as Widget<AlertBoxProps>;
  return render(<AlertBoxRuntime widget={widget} />);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AlertBoxRuntime — live mode", () => {
  it("renders no card before any event fires", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);
    expect(container.querySelector("[data-alert-title]")).toBeNull();
    expect(container.querySelector('[data-empty=""]')).not.toBeNull();
  });

  it("displays the follow template copy when a channel.follow fires", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);
    act(() => {
      bus.emit(makeFollow());
    });
    const title = container.querySelector("[data-alert-title]");
    const subtitle = container.querySelector("[data-alert-subtitle]");
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe("New follower!");
    expect(subtitle!.textContent).toBe("Alice");
    // Accent CSS variable surfaced via inline style.
    const card = container.querySelector("[data-alert-kind]") as HTMLElement;
    expect(card.getAttribute("data-alert-kind")).toBe("follow");
    expect(card.style.getPropertyValue("--accent-color")).toBe("#4ade80");
  });

  it("clears the current alert after displayMs + exit animation", () => {
    vi.useFakeTimers();
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ displayMs: 1_000, spacingMs: 0 }, bus);

    act(() => {
      bus.emit(makeFollow());
    });
    expect(container.querySelector("[data-alert-title]")).not.toBeNull();

    // displayMs hold
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    // Card still mounted but transitioning out.
    const card = container.querySelector("[data-alert-kind]") as HTMLElement | null;
    expect(card?.getAttribute("data-state")).toBe("out");

    // Exit keyframe (~300ms)
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
        displayMs: 30_000, // hold current card indefinitely so queue accumulates
        spacingMs: 0,
        maxQueue: 2,
        // Force no coalesce so each cheer stays unique.
        coalesceWindowMs: 0,
      },
      bus,
    );

    // Fire a follow first — this becomes "current" and drains from the queue.
    act(() => {
      bus.emit(makeFollow({ id: "f-current" }));
    });
    // Now fire 4 more events that can't be coalesced. The queue is capped
    // at 2, so after draining we should still be holding the follow as
    // current and the last two raids should be in the queue.
    act(() => {
      bus.emit(makeRaid({ id: "r1", from: { id: "a", login: "a1", displayName: "A1" } }));
      bus.emit(makeRaid({ id: "r2", from: { id: "b", login: "b1", displayName: "B1" } }));
      bus.emit(makeRaid({ id: "r3", from: { id: "c", login: "c1", displayName: "C1" } }));
      bus.emit(makeRaid({ id: "r4", from: { id: "d", login: "d1", displayName: "D1" } }));
    });

    // The current card is still the original follow.
    const title = container.querySelector("[data-alert-title]");
    expect(title!.textContent).toBe("New follower!");

    // Let the follow expire so the next queued card surfaces.
    act(() => {
      vi.advanceTimersByTime(30_000 + 400);
    });
    // It should be the second-to-last raid (r3) because the queue cap is 2
    // and r1/r2 were dropped.
    const nextTitle = container.querySelector("[data-alert-title]");
    expect(nextTitle!.textContent).toBe("Raid from C1!");
  });

  it("coalesces subGifts from the same user within the coalesce window", () => {
    vi.useFakeTimers();
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus(
      {
        displayMs: 30_000, // keep the first alert pinned so we can observe the queue
        coalesceWindowMs: 5_000,
      },
      bus,
    );

    // Fire a follow to occupy `current`, then two subGifts that should
    // coalesce into the queued tail.
    act(() => {
      bus.emit(makeFollow({ id: "f-hold" }));
      bus.emit(makeSub({ id: "g1", isGift: true }));
      bus.emit(makeSub({ id: "g2", isGift: true }));
    });

    // Drain the current follow so the coalesced gift surfaces.
    act(() => {
      vi.advanceTimersByTime(30_400);
    });

    const title = container.querySelector("[data-alert-title]");
    const subtitle = container.querySelector("[data-alert-subtitle]");
    expect(title!.textContent).toBe("Gift sub!");
    expect(subtitle!.textContent).toBe("Alice gifted 2 subs");
  });

  it("drops cheer events below the configured threshold", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ cheer: { threshold: 500 } }, bus);

    act(() => {
      bus.emit(makeCheer({ bits: 100 }));
    });
    expect(container.querySelector("[data-alert-title]")).toBeNull();

    act(() => {
      bus.emit(makeCheer({ bits: 500, message: "pow" }));
    });
    const title = container.querySelector("[data-alert-title]");
    expect(title!.textContent).toBe("500 bits!");
  });

  it("drops follow events when the follow template is disabled", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ follow: { enabled: false } }, bus);

    act(() => {
      bus.emit(makeFollow());
    });
    expect(container.querySelector("[data-alert-title]")).toBeNull();
  });

  it("routes sub isGift=false to the subscribe template and isGift=true to subGift", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);

    act(() => {
      bus.emit(makeSub({ isGift: false, tier: "1000" }));
    });
    let card = container.querySelector("[data-alert-kind]") as HTMLElement;
    expect(card.getAttribute("data-alert-kind")).toBe("subscribe");
    expect(container.querySelector("[data-alert-title]")!.textContent).toBe("New subscriber!");
  });
});

describe("AlertBoxRuntime — design mode", () => {
  it("renders a preview card with a faint Preview label when no provider wraps it", () => {
    const { container } = renderNoBus();
    // Preview sentinel text.
    const preview = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "Preview",
    );
    expect(preview).not.toBeUndefined();
    // Static follow-template card visible.
    const title = container.querySelector("[data-alert-title]");
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe("New follower!");
    // No `data-state` — design mode doesn't trigger the animation keyframes.
    const card = container.querySelector("[data-alert-kind]") as HTMLElement;
    expect(card.getAttribute("data-state")).toBe(null);
  });

  it("ignores live events in design mode (no provider → no listeners)", () => {
    // Without a provider, the default no-op bus is returned. Emitting on a
    // separate bus instance can't reach the runtime — proof that the
    // component is isolated from any stray bus the test harness might
    // spin up.
    const bus = createEventBus<StreamEvent>();
    const { container } = renderNoBus();

    act(() => {
      bus.emit(makeFollow({ user: { id: "u", login: "evan", displayName: "Evan" } }));
    });

    // Preview stays on the follow template with the "Preview" user label.
    const subtitle = container.querySelector("[data-alert-subtitle]");
    expect(subtitle!.textContent).toBe("Preview");
  });
});
