import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEventBus,
  OverlayBusProvider,
  type CheerEvent,
  type DonationEvent,
  type EventBus,
  type StreamEvent,
  type Widget,
} from "@obs/core";
import { createWidget } from "../registry";
// Importing the barrel registers the speak-alert kind alongside the others.
import "../index";
import { speakAlertSchema, type SpeakAlertProps } from "./schema";
import { SpeakAlertRuntime } from "./Runtime";

/* -------------------------------------------------------------------------- */
/* Mocks                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One fake SpeakQueue shared across tests. `speak(...)` records the call and
 * returns a handle whose `_emit` helper lets the test drive `start`/
 * `boundary`/`finish` events synchronously. Every test starts with a clean
 * instance via `beforeEach`.
 */
interface FakeSpeakHandle {
  cancel: ReturnType<typeof vi.fn>;
  done: Promise<void>;
  onEvent: (listener: (e: unknown) => void) => () => void;
  _emit: (evt: unknown) => void;
  _finish: () => void;
  cancelled: boolean;
}

interface FakeSpeakQueue {
  speak: ReturnType<typeof vi.fn>;
  cancelAll: ReturnType<typeof vi.fn>;
  handles: FakeSpeakHandle[];
}

const fakeQueueStore: { queue: FakeSpeakQueue | null } = { queue: null };

function makeFakeHandle(): FakeSpeakHandle {
  const listeners = new Set<(e: unknown) => void>();
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((r) => {
    resolveDone = r;
  });
  return {
    cancel: vi.fn(function cancelImpl(this: FakeSpeakHandle) {
      this.cancelled = true;
      listeners.clear();
      resolveDone();
    }),
    done,
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    _emit(evt) {
      for (const l of listeners) l(evt);
    },
    _finish() {
      for (const l of listeners) l({ type: "finish" });
      listeners.clear();
      resolveDone();
    },
    cancelled: false,
  };
}

vi.mock("@obs/tts", async () => {
  const actual = await vi.importActual<typeof import("@obs/tts")>("@obs/tts");

  class MockSpeakQueue {
    speak = vi.fn();
    cancelAll = vi.fn();
    handles: FakeSpeakHandle[] = [];
    constructor() {
      this.speak.mockImplementation((_message: string, _opts: unknown) => {
        const handle = makeFakeHandle();
        this.handles.push(handle);
        return handle;
      });
      // Track the latest instance so tests can reach in via `fakeQueueStore`.
      fakeQueueStore.queue = this as unknown as FakeSpeakQueue;
    }
  }

  return {
    ...actual,
    SpeakQueue: MockSpeakQueue,
  };
});

// We also stub @obs/effects so we can assert playEffect was called with the
// expected descriptor without any DOM animation side-effects.
const playEffectMock = vi.fn();
vi.mock("@obs/effects", () => ({
  playEffect: (...args: unknown[]) => playEffectMock(...args),
}));

/* -------------------------------------------------------------------------- */
/* Factories                                                                  */
/* -------------------------------------------------------------------------- */

function makeDonation(over: Partial<DonationEvent> = {}): DonationEvent {
  return {
    kind: "donation",
    id: over.id ?? "d1",
    source: over.source ?? "streamteam-tip",
    user: over.user === undefined ? { displayName: "Alice", login: "alice" } : over.user,
    amount: over.amount ?? 500,
    currency: over.currency ?? "USD",
    message: over.message ?? "(excited) hello there",
    receivedAt: over.receivedAt ?? Date.parse("2024-01-01T00:00:00Z"),
    ...(over.feeAmount !== undefined ? { feeAmount: over.feeAmount } : {}),
    ...(over.coveredFees !== undefined ? { coveredFees: over.coveredFees } : {}),
  };
}

function makeCheer(over: Partial<CheerEvent> = {}): CheerEvent {
  return {
    kind: "channel.cheer",
    id: over.id ?? "c1",
    user: over.user === undefined ? { id: "u", login: "alice", displayName: "Alice" } : over.user,
    bits: over.bits ?? 200,
    message: over.message ?? "(angry) pow",
    receivedAt: over.receivedAt ?? Date.parse("2024-01-01T00:00:00Z"),
  };
}

function makeProps(partial: Partial<Record<keyof SpeakAlertProps, unknown>> = {}): SpeakAlertProps {
  return speakAlertSchema.parse(partial);
}

function renderWithBus(
  partial: Partial<Record<keyof SpeakAlertProps, unknown>>,
  bus: EventBus<StreamEvent>,
) {
  const widget = createWidget("speak-alert", {
    props: makeProps(partial),
  }) as Widget<SpeakAlertProps>;
  const result = render(
    <OverlayBusProvider bus={bus}>
      <SpeakAlertRuntime widget={widget} />
    </OverlayBusProvider>,
  );
  return { ...result, widget };
}

function renderNoBus(partial: Partial<Record<keyof SpeakAlertProps, unknown>> = {}) {
  const widget = createWidget("speak-alert", {
    props: makeProps(partial),
  }) as Widget<SpeakAlertProps>;
  return render(<SpeakAlertRuntime widget={widget} />);
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  fakeQueueStore.queue = null;
  playEffectMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SpeakAlertRuntime — design mode", () => {
  it("renders a Preview card with the sample text but never calls TTS", () => {
    const { container } = renderNoBus();
    const preview = container.querySelector(".previewLabel");
    expect(preview?.textContent).toBe("Preview");
    const title = container.querySelector("[data-speak-title]");
    expect(title?.textContent).toBe("Preview · $3.00 USD");
    // The sample speakText has two emotion segments — excited + shy.
    const segments = container.querySelectorAll("[data-segment-index]");
    expect(segments.length).toBeGreaterThanOrEqual(2);
    const emotions = Array.from(segments).map((s) => s.getAttribute("data-segment-emotion"));
    expect(emotions).toContain("excited");
    expect(emotions).toContain("shy");
    // TTS must not have been invoked in design mode.
    expect(fakeQueueStore.queue?.speak).not.toHaveBeenCalled();
  });
});

describe("SpeakAlertRuntime — live mode", () => {
  it("renders nothing until an accepted event arrives", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);
    expect(container.querySelector("[data-speak-title]")).toBeNull();
    expect(container.querySelector('[data-empty=""]')).not.toBeNull();
  });

  it("enqueues and renders a donation event above the threshold", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ minDonationAmount: 100 }, bus);
    act(() => {
      bus.emit(makeDonation({ amount: 500, currency: "USD", message: "(happy) nice" }));
    });
    const title = container.querySelector("[data-speak-title]");
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe("Alice · 5.00 USD");
    // Accent defaults to the streamteam-tip violet.
    const card = container.querySelector("[data-speak-kind]") as HTMLElement;
    expect(card.style.getPropertyValue("--accent-color")).toBe("#8b5cf6");
  });

  it("drops a donation below the threshold without rendering a card", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ minDonationAmount: 1_000 }, bus);
    act(() => {
      bus.emit(makeDonation({ amount: 500 }));
    });
    expect(container.querySelector("[data-speak-title]")).toBeNull();
  });

  it("ignores a cheer when speakCheer is false", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ speakCheer: false }, bus);
    act(() => {
      bus.emit(makeCheer({ bits: 500 }));
    });
    expect(container.querySelector("[data-speak-title]")).toBeNull();
  });

  it("calls SpeakQueue.speak with the interpolated text + lang + multipliers", () => {
    const bus = createEventBus<StreamEvent>();
    renderWithBus(
      {
        ttsRate: 1.2,
        ttsVolume: 0.6,
        ttsLang: "en-GB",
        speakTemplate: "Thanks {user}: {message}",
      },
      bus,
    );
    act(() => {
      bus.emit(makeDonation({ message: "(excited) WOOO" }));
    });
    const queue = fakeQueueStore.queue!;
    expect(queue.speak).toHaveBeenCalledTimes(1);
    const [message, opts] = queue.speak.mock.calls[0]!;
    expect(message).toBe("Thanks Alice: (excited) WOOO");
    expect(opts.lang).toBe("en-GB");
    expect(opts.rateMultiplier).toBe(1.2);
    expect(opts.volumeMultiplier).toBe(0.6);
    expect(opts.defaultEmotion).toBe("normal");
  });

  it("fires playEffect on a segment with emotion 'angry'", () => {
    const bus = createEventBus<StreamEvent>();
    renderWithBus({}, bus);
    act(() => {
      bus.emit(makeDonation({ message: "(angry) rrr" }));
    });
    const queue = fakeQueueStore.queue!;
    const handle = queue.handles[0]!;
    // Simulate the TTS driver firing a start event on our (synthetic) segment.
    act(() => {
      handle._emit({
        type: "start",
        segmentIndex: 0,
        segment: { text: "rrr", emotion: "angry", range: { start: 0, end: 3 } },
      });
    });
    expect(playEffectMock).toHaveBeenCalledTimes(1);
    const [, effect] = playEffectMock.mock.calls[0]!;
    expect(effect.type).toBe("shake");
    expect(effect.amplitude).toBeCloseTo(8 * 1.5);
    expect(effect.durationMs).toBe(400);
  });

  it("highlights the matching word span when a boundary event fires", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ speakTemplate: "hello world friend" }, bus);
    act(() => {
      bus.emit(makeDonation({ message: "" }));
    });
    const queue = fakeQueueStore.queue!;
    const handle = queue.handles[0]!;
    // "hello world friend" — "world" starts at char index 6 in segment 0.
    act(() => {
      handle._emit({
        type: "boundary",
        segmentIndex: 0,
        segment: {
          text: "hello world friend",
          emotion: "normal",
          range: { start: 0, end: 18 },
        },
        charIndex: 6,
        charLength: 5,
      });
    });
    const activeWords = Array.from(container.querySelectorAll("[data-word][data-active]"));
    expect(activeWords).toHaveLength(1);
    expect(activeWords[0]!.textContent).toBe("world");
  });

  it("cancels any in-flight SpeakHandle when the runtime unmounts", () => {
    const bus = createEventBus<StreamEvent>();
    const { unmount } = renderWithBus({}, bus);
    act(() => {
      bus.emit(makeDonation({ message: "(excited) hi" }));
    });
    const queue = fakeQueueStore.queue!;
    const handle = queue.handles[0]!;
    expect(handle.cancel).not.toHaveBeenCalled();
    unmount();
    expect(handle.cancel).toHaveBeenCalled();
    expect(queue.cancelAll).toHaveBeenCalled();
  });

  it("drops the oldest queued items when maxQueue overflows", () => {
    vi.useFakeTimers();
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus(
      {
        maxQueue: 2,
        ttsEnabled: false,
        displayMs: 30_000, // pin the current card so the rest queue up
        spacingMs: 0,
      },
      bus,
    );
    // Emit the first donation in its own act — this flushes the pop effect
    // so `current = A` before the next batch overflows the queue.
    act(() => {
      bus.emit(makeDonation({ id: "d1", user: { displayName: "A" }, amount: 100 }));
    });
    expect(container.querySelector("[data-speak-title]")!.textContent).toBe("A · 1.00 USD");
    // Now emit three more while A is still displayed. The queue can only
    // hold 2 — the oldest (B) is dropped, leaving [C, D].
    act(() => {
      bus.emit(makeDonation({ id: "d2", user: { displayName: "B" }, amount: 100 }));
      bus.emit(makeDonation({ id: "d3", user: { displayName: "C" }, amount: 100 }));
      bus.emit(makeDonation({ id: "d4", user: { displayName: "D" }, amount: 100 }));
    });
    // Current is still A.
    expect(container.querySelector("[data-speak-title]")!.textContent).toBe("A · 1.00 USD");
    // Drain A so the next queued card surfaces.
    act(() => {
      vi.advanceTimersByTime(30_000 + 400);
    });
    // We expect C next — B was dropped due to maxQueue=2.
    expect(container.querySelector("[data-speak-title]")!.textContent).toBe("C · 1.00 USD");
  });

  it("renders a card without calling TTS when ttsEnabled is false", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ ttsEnabled: false }, bus);
    act(() => {
      bus.emit(makeDonation({ message: "(happy) great" }));
    });
    const title = container.querySelector("[data-speak-title]");
    expect(title).not.toBeNull();
    // A fake queue exists (constructed on mount) — speak must not have been invoked.
    const queue = fakeQueueStore.queue!;
    expect(queue.speak).not.toHaveBeenCalled();
  });

  it("honours accentFromSource: false by using accentOverride", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus(
      { accentFromSource: false, accentOverride: "#ff00ff" },
      bus,
    );
    act(() => {
      bus.emit(makeDonation({}));
    });
    const card = container.querySelector("[data-speak-kind]") as HTMLElement;
    expect(card.style.getPropertyValue("--accent-color")).toBe("#ff00ff");
  });
});
