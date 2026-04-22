import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEventBus,
  OverlayBusProvider,
  type ChatFragment,
  type ChatMessage,
  type EventBus,
  type StreamEvent,
  type Widget,
} from "@obs/core";
import { createWidget } from "../registry";
// Importing the barrel registers the emote-wall kind.
import "../index";
import { emoteWallSchema, type EmoteWallProps } from "./schema";
import { EmoteWallRuntime } from "./Runtime";

/**
 * The Runtime schedules an rAF loop for the physics step. Tests don't
 * assert on computed transforms (fragile + depends on real layout that
 * happy-dom doesn't perform). Stubbing rAF to a no-op keeps the loop from
 * firing while still letting the effect register a cancelable id.
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

function makeChatMessage(over: Partial<ChatMessage> & { fragments?: ChatFragment[] }): ChatMessage {
  const fragments: ChatFragment[] = over.fragments ?? [
    { type: "text", text: "hi" },
    {
      type: "emote",
      text: "Kappa",
      emoteId: "25",
      emoteUrl: "https://example.test/emote-25.png",
    },
  ];
  return {
    kind: "chat.message",
    id: over.id ?? "m1",
    user: over.user ?? {
      id: "u1",
      login: "alice",
      displayName: "Alice",
      roles: ["viewer"],
    },
    fragments,
    plain: over.plain ?? fragments.map((f) => f.text).join(""),
    receivedAt: over.receivedAt ?? Date.now(),
  };
}

function makeProps(partial: Partial<Record<keyof EmoteWallProps, unknown>> = {}) {
  return emoteWallSchema.parse(partial);
}

function renderWithBus(
  partial: Partial<Record<keyof EmoteWallProps, unknown>>,
  bus: EventBus<StreamEvent>,
) {
  const widget = createWidget("emote-wall", {
    props: makeProps(partial),
  }) as Widget<EmoteWallProps>;
  const result = render(
    <OverlayBusProvider bus={bus}>
      <EmoteWallRuntime widget={widget} />
    </OverlayBusProvider>,
  );
  return { ...result, widget };
}

function renderNoBus(partial: Partial<Record<keyof EmoteWallProps, unknown>> = {}) {
  const widget = createWidget("emote-wall", {
    props: makeProps(partial),
  }) as Widget<EmoteWallProps>;
  return render(<EmoteWallRuntime widget={widget} />);
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

describe("EmoteWallRuntime", () => {
  it("renders no particles when no chat events have arrived", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);
    const root = container.querySelector('[data-widget-kind="emote-wall"]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.getAttribute("data-particle-count")).toBe("0");
    expect(container.querySelectorAll('[data-particle=""]').length).toBe(0);
  });

  it("spawns exactly spawnPerEmote particles per emote fragment (spawnPerEmote=1)", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ spawnPerEmote: 1 }, bus);

    act(() => {
      bus.emit(
        makeChatMessage({
          fragments: [
            { type: "text", text: "hi " },
            {
              type: "emote",
              text: "Kappa",
              emoteId: "25",
              emoteUrl: "https://example.test/e1.png",
            },
          ],
        }),
      );
    });

    const particles = container.querySelectorAll('[data-particle=""]');
    expect(particles.length).toBe(1);
    expect((particles[0] as HTMLImageElement).src).toBe("https://example.test/e1.png");
  });

  it("spawnPerEmote=3 emits three particles per single emote fragment", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ spawnPerEmote: 3 }, bus);

    act(() => {
      bus.emit(
        makeChatMessage({
          fragments: [
            {
              type: "emote",
              text: "Kappa",
              emoteId: "25",
              emoteUrl: "https://example.test/e.png",
            },
          ],
        }),
      );
    });

    expect(container.querySelectorAll('[data-particle=""]').length).toBe(3);
  });

  it("drops cheermote fragments when includeCheermotes is false", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ includeCheermotes: false }, bus);

    act(() => {
      bus.emit(
        makeChatMessage({
          fragments: [
            {
              type: "cheermote",
              text: "Cheer100",
              emoteId: "cheer100",
              emoteUrl: "https://example.test/cheer.png",
              bits: 100,
            },
          ],
        }),
      );
    });

    expect(container.querySelectorAll('[data-particle=""]').length).toBe(0);

    // Sanity: a real emote on the same widget still lands.
    act(() => {
      bus.emit(
        makeChatMessage({
          id: "m2",
          fragments: [
            {
              type: "emote",
              text: "K",
              emoteId: "25",
              emoteUrl: "https://example.test/e.png",
            },
          ],
        }),
      );
    });
    expect(container.querySelectorAll('[data-particle=""]').length).toBe(1);
  });

  it("drops viewer-role messages when onlySubscribers is true", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ onlySubscribers: true }, bus);

    // Viewer-only message — gate rejects it.
    act(() => {
      bus.emit(
        makeChatMessage({
          user: { id: "u1", login: "alice", displayName: "Alice", roles: ["viewer"] },
        }),
      );
    });
    expect(container.querySelectorAll('[data-particle=""]').length).toBe(0);

    // Subscriber message passes.
    act(() => {
      bus.emit(
        makeChatMessage({
          id: "m2",
          user: {
            id: "u2",
            login: "sub",
            displayName: "Sub",
            roles: ["viewer", "subscriber"],
          },
        }),
      );
    });
    expect(container.querySelectorAll('[data-particle=""]').length).toBe(1);

    // Broadcaster also passes.
    act(() => {
      bus.emit(
        makeChatMessage({
          id: "m3",
          user: {
            id: "u3",
            login: "streamer",
            displayName: "Streamer",
            roles: ["broadcaster"],
          },
        }),
      );
    });
    expect(container.querySelectorAll('[data-particle=""]').length).toBe(2);
  });

  it("drops the oldest particles when maxParticles overflows", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ maxParticles: 3, spawnPerEmote: 1 }, bus);

    act(() => {
      // 5 emotes → maxParticles=3 drops the oldest 2.
      for (let i = 0; i < 5; i += 1) {
        bus.emit(
          makeChatMessage({
            id: `m${i}`,
            fragments: [
              {
                type: "emote",
                text: `K${i}`,
                emoteId: String(i),
                emoteUrl: `https://example.test/e${i}.png`,
              },
            ],
          }),
        );
      }
    });

    const particles = Array.from(
      container.querySelectorAll('[data-particle=""]'),
    ) as HTMLImageElement[];
    expect(particles.length).toBe(3);
    // The surviving emotes are the last three (indices 2, 3, 4).
    const srcs = particles.map((p) => p.src);
    expect(srcs).toEqual([
      "https://example.test/e2.png",
      "https://example.test/e3.png",
      "https://example.test/e4.png",
    ]);
  });

  it("design mode renders 6 preview particles and a 'Preview' label", () => {
    // happy-dom returns 0 for clientWidth/clientHeight by default. The
    // Runtime's preview seeding guards on non-zero dims; stub the getters
    // so the measurement succeeds.
    const wProto = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const hProto = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 720,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 520,
    });

    try {
      const { container } = renderNoBus();
      const particles = container.querySelectorAll('[data-particle=""]');
      expect(particles.length).toBe(6);

      const label = Array.from(container.querySelectorAll("span")).find(
        (s) => s.textContent === "Preview",
      );
      expect(label).not.toBeUndefined();
    } finally {
      if (wProto) Object.defineProperty(HTMLElement.prototype, "clientWidth", wProto);
      if (hProto) Object.defineProperty(HTMLElement.prototype, "clientHeight", hProto);
    }
  });

  it("builds CDN URL from emoteId when emoteUrl is missing", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);

    act(() => {
      bus.emit(
        makeChatMessage({
          fragments: [
            {
              type: "emote",
              text: "Kappa",
              emoteId: "25",
              // emoteUrl deliberately omitted
            },
          ],
        }),
      );
    });

    const particles = container.querySelectorAll(
      '[data-particle=""]',
    ) as NodeListOf<HTMLImageElement>;
    expect(particles.length).toBe(1);
    expect(particles[0]!.src).toBe("https://static-cdn.jtvnw.net/emoticons/v2/25/static/dark/2.0");
  });

  it("drops first-party emotes when includeFirstPartyEmotes is false", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ includeFirstPartyEmotes: false }, bus);

    act(() => {
      bus.emit(
        makeChatMessage({
          fragments: [
            {
              type: "emote",
              text: "Kappa",
              emoteId: "25",
              emoteUrl: "https://example.test/e.png",
            },
          ],
        }),
      );
    });

    expect(container.querySelectorAll('[data-particle=""]').length).toBe(0);
  });
});
