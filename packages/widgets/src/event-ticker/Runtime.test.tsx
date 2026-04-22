import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEventBus,
  OverlayBusProvider,
  type CheerEvent,
  type DonationEvent,
  type EventBus,
  type FollowEvent,
  type RaidEvent,
  type StreamEvent,
  type Widget,
} from "@obs/core";
import { createWidget } from "../registry";
// Importing the barrel registers the event-ticker kind.
import "../index";
import { eventTickerSchema, type EventTickerProps } from "./schema";
import { EventTickerRuntime, relativeTime, __internals } from "./Runtime";

/**
 * The Runtime schedules an rAF loop for scroll animation. Tests don't
 * assert on the computed `transform` (fragile + depends on real layout
 * that happy-dom doesn't perform), and the loop calls `performance.now()`
 * every frame which would churn under `vi.useFakeTimers()`. Stubbing rAF
 * to a no-op keeps the loop from firing while still letting the effect
 * register a cancelable id.
 */
function stubRaf() {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (() => 1) as unknown as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => undefined) as unknown as typeof cancelAnimationFrame;
  return () => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancel;
  };
}

function makeFollow(over: Partial<FollowEvent> = {}): FollowEvent {
  return {
    kind: "channel.follow",
    id: over.id ?? "f1",
    user: over.user ?? { id: "u1", login: "alice", displayName: "Alice" },
    receivedAt: over.receivedAt ?? Date.now(),
  };
}

function makeCheer(over: Partial<CheerEvent> = {}): CheerEvent {
  return {
    kind: "channel.cheer",
    id: over.id ?? "c1",
    user: over.user ?? { id: "u1", login: "alice", displayName: "Alice" },
    bits: over.bits ?? 100,
    message: over.message ?? "woo",
    receivedAt: over.receivedAt ?? Date.now(),
  };
}

function makeRaid(over: Partial<RaidEvent> = {}): RaidEvent {
  return {
    kind: "channel.raid",
    id: over.id ?? "r1",
    from: over.from ?? { id: "u1", login: "alice", displayName: "Alice" },
    viewers: over.viewers ?? 42,
    receivedAt: over.receivedAt ?? Date.now(),
  };
}

function makeDonation(over: Partial<DonationEvent> = {}): DonationEvent {
  return {
    kind: "donation",
    id: over.id ?? "d1",
    source: over.source ?? "streamlabs",
    user: over.user ?? { displayName: "Alice", login: "alice" },
    amount: over.amount ?? 500,
    currency: over.currency ?? "USD",
    message: over.message,
    receivedAt: over.receivedAt ?? Date.now(),
  };
}

function makeProps(partial: Partial<Record<keyof EventTickerProps, unknown>> = {}) {
  return eventTickerSchema.parse(partial);
}

function renderWithBus(
  partial: Partial<Record<keyof EventTickerProps, unknown>>,
  bus: EventBus<StreamEvent>,
) {
  const widget = createWidget("event-ticker", {
    props: makeProps(partial),
  }) as Widget<EventTickerProps>;
  const result = render(
    <OverlayBusProvider bus={bus}>
      <EventTickerRuntime widget={widget} />
    </OverlayBusProvider>,
  );
  return { ...result, widget };
}

function renderNoBus(partial: Partial<Record<keyof EventTickerProps, unknown>> = {}) {
  const widget = createWidget("event-ticker", {
    props: makeProps(partial),
  }) as Widget<EventTickerProps>;
  return render(<EventTickerRuntime widget={widget} />);
}

let restoreRaf: (() => void) | null = null;

beforeEach(() => {
  restoreRaf = stubRaf();
});

afterEach(() => {
  cleanup();
  restoreRaf?.();
  restoreRaf = null;
  vi.useRealTimers();
});

describe("EventTickerRuntime", () => {
  it("renders empty with data-empty in live mode when no events have arrived", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);
    const root = container.querySelector('[data-widget-kind="event-ticker"]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.getAttribute("data-empty")).toBe("");
    const entries = container.querySelectorAll('[data-ticker-entry=""]');
    expect(entries.length).toBe(0);
  });

  it("appends an entry for a follow event with Heart icon + 'followed' text", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);

    act(() => {
      bus.emit(makeFollow({ user: { id: "u", login: "alice", displayName: "Alice" } }));
    });

    const entries = container.querySelectorAll('[data-ticker-entry=""]');
    expect(entries.length).toBe(1);
    const entry = entries[0] as HTMLElement;
    expect(entry.getAttribute("data-ticker-kind")).toBe("follow");
    expect(entry.querySelector('[data-ticker-user=""]')!.textContent).toBe("Alice");
    expect(entry.querySelector('[data-ticker-text=""]')!.textContent).toBe("followed");
    // Icon toggle defaults on → icon slot exists.
    expect(entry.querySelector('[data-ticker-icon=""]')).not.toBeNull();
  });

  it("drops follow events when includeFollow is false", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ includeFollow: false }, bus);

    act(() => {
      bus.emit(makeFollow());
    });
    expect(container.querySelectorAll('[data-ticker-entry=""]').length).toBe(0);

    // Sanity: a cheer still lands.
    act(() => {
      bus.emit(makeCheer({ bits: 42 }));
    });
    const entries = container.querySelectorAll('[data-ticker-entry=""]');
    expect(entries.length).toBe(1);
    expect((entries[0] as HTMLElement).getAttribute("data-ticker-kind")).toBe("cheer");
  });

  it("drops the oldest entry when maxEntries overflows", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ maxEntries: 3 }, bus);

    act(() => {
      for (let i = 0; i < 5; i += 1) {
        bus.emit(
          makeFollow({
            id: `f${i}`,
            user: { id: `u${i}`, login: `user${i}`, displayName: `User${i}` },
          }),
        );
      }
    });

    const entries = Array.from(container.querySelectorAll('[data-ticker-entry=""]'));
    expect(entries.length).toBe(3);
    const users = entries.map((e) => e.querySelector('[data-ticker-user=""]')!.textContent);
    // Oldest two dropped — expect User2, User3, User4 in order.
    expect(users).toEqual(["User2", "User3", "User4"]);
  });

  it("coalesces same-user cheers within coalesceWindowMs and sums bits", () => {
    const bus = createEventBus<StreamEvent>();
    const now = 1_700_000_000_000;
    const { container } = renderWithBus({ coalesceWindowMs: 2_000 }, bus);

    act(() => {
      bus.emit(makeCheer({ id: "c1", bits: 100, receivedAt: now }));
      bus.emit(makeCheer({ id: "c2", bits: 250, receivedAt: now + 500 }));
    });

    const entries = container.querySelectorAll('[data-ticker-entry=""]');
    // Both cheers fold into a single entry with bits = 350.
    expect(entries.length).toBe(1);
    expect((entries[0] as HTMLElement).querySelector('[data-ticker-text=""]')!.textContent).toBe(
      "cheered 350 bits",
    );
  });

  it("does NOT coalesce donations with mismatched currencies", () => {
    const bus = createEventBus<StreamEvent>();
    const now = 1_700_000_000_000;
    const { container } = renderWithBus({ coalesceWindowMs: 2_000 }, bus);

    act(() => {
      bus.emit(makeDonation({ id: "d1", amount: 500, currency: "USD", receivedAt: now }));
      bus.emit(
        makeDonation({
          id: "d2",
          amount: 500,
          currency: "EUR",
          receivedAt: now + 200,
        }),
      );
    });

    const entries = Array.from(container.querySelectorAll('[data-ticker-entry=""]'));
    expect(entries.length).toBe(2);
    const texts = entries.map((e) => e.querySelector('[data-ticker-text=""]')!.textContent);
    expect(texts[0]).toBe("donated 5.00 USD");
    expect(texts[1]).toBe("donated 5.00 EUR");
  });

  it("design mode renders three preview entries and doesn't subscribe to a live bus", () => {
    const { container } = renderNoBus();
    const entries = container.querySelectorAll('[data-ticker-entry=""]');
    expect(entries.length).toBe(3);
    const kinds = Array.from(entries).map((e) =>
      (e as HTMLElement).getAttribute("data-ticker-kind"),
    );
    expect(kinds).toEqual(["cheer", "follow", "raid"]);

    // The "Preview" label renders.
    const label = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "Preview",
    );
    expect(label).not.toBeUndefined();
  });

  it("relativeTime renders 'now' under 5s and seconds after", () => {
    // Unit test first — mirrors the helper's contract.
    expect(relativeTime(5_000, 5_000)).toBe("now");
    expect(relativeTime(5_000 + 4_999, 5_000)).toBe("now");
    expect(relativeTime(5_000 + 5_000, 5_000)).toBe("5s");
    expect(relativeTime(5_000 + 59_999, 5_000)).toBe("59s");
    expect(relativeTime(5_000 + 60_000, 5_000)).toBe("1m");
    expect(relativeTime(5_000 + 60 * 60_000, 5_000)).toBe("1h");
    expect(relativeTime(5_000 + 24 * 60 * 60_000, 5_000)).toBe("1d");
  });

  it("renders the relative time next to each entry when showTimestamps is on", () => {
    vi.useFakeTimers();
    const baseNow = Date.parse("2024-01-01T00:00:00Z");
    vi.setSystemTime(baseNow);

    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ showTimestamps: true }, bus);

    act(() => {
      bus.emit(makeRaid({ receivedAt: baseNow }));
    });
    let time = container.querySelector('[data-ticker-time=""]') as HTMLElement | null;
    expect(time).not.toBeNull();
    // Less than 5s elapsed → "now".
    expect(time!.textContent).toBe("now");

    // Advance Date.now() past the 5-second threshold and force a rerender.
    act(() => {
      vi.setSystemTime(baseNow + 10_000);
      // Re-emit a cheer to trigger a React update (relativeTime is
      // computed during render; without a render it won't retick).
      bus.emit(makeCheer({ id: "tick", bits: 1, receivedAt: baseNow + 10_000 }));
    });
    const times = Array.from(container.querySelectorAll('[data-ticker-time=""]'));
    // First entry should now read "10s" (or similar seconds bucket).
    expect(times[0]!.textContent).toMatch(/^\d+s$/);
  });
});

describe("EventTickerRuntime — __internals", () => {
  it("entryFromEvent returns null for an unhandled kind", () => {
    // Force a made-up kind through the helper to verify the null path —
    // the union discriminator in TS would normally prevent this at the
    // call site.
    const fake = { kind: "nope" } as unknown as StreamEvent;
    expect(__internals.entryFromEvent(fake, 0, "uid")).toBeNull();
  });

  it("eventEnabled obeys the include flags for each kind", () => {
    const props = eventTickerSchema.parse({
      includeFollow: false,
      includeCheer: true,
      includeChat: false,
    });
    expect(__internals.eventEnabled(makeFollow(), props)).toBe(false);
    expect(__internals.eventEnabled(makeCheer(), props)).toBe(true);
    expect(
      __internals.eventEnabled(
        {
          kind: "chat.message",
          id: "x",
          user: { id: "u", login: "a", displayName: "A", roles: ["viewer"] },
          fragments: [{ type: "text", text: "hi" }],
          plain: "hi",
          receivedAt: 0,
        },
        props,
      ),
    ).toBe(false);
  });
});
