import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEventBus,
  OverlayBusProvider,
  type ChatMessage,
  type EventBus,
  type StreamEvent,
  type Widget,
} from "@obs/core";
import { createWidget } from "../registry";
// Importing the barrel is what registers the chat-feed kind.
import "../index";
import type { ChatFeedProps } from "./schema";
import { ChatFeedRuntime } from "./Runtime";

/**
 * Helpers ---------------------------------------------------------------
 */

function makeChat(
  overrides: Partial<ChatMessage> &
    Partial<{ userColor: string; roles: ChatMessage["user"]["roles"] }> = {},
): ChatMessage {
  const userColor =
    "userColor" in overrides ? (overrides as { userColor?: string }).userColor : undefined;
  const rolesOverride =
    "roles" in overrides
      ? (overrides as { roles?: ChatMessage["user"]["roles"] }).roles
      : undefined;
  return {
    kind: "chat.message",
    id: overrides.id ?? `m-${Math.random().toString(36).slice(2)}`,
    user: overrides.user ?? {
      id: "u1",
      login: "alice",
      displayName: "Alice",
      color: userColor,
      roles: rolesOverride ?? ["viewer"],
    },
    fragments: overrides.fragments ?? [{ type: "text", text: overrides.plain ?? "hello world" }],
    plain: overrides.plain ?? "hello world",
    receivedAt: overrides.receivedAt ?? Date.parse("2024-01-01T13:45:00Z"),
  };
}

function renderWithBus(props: Partial<ChatFeedProps>, bus: EventBus<StreamEvent>) {
  const widget = createWidget("chat-feed", { props }) as Widget<ChatFeedProps>;
  const result = render(
    <OverlayBusProvider bus={bus}>
      <ChatFeedRuntime widget={widget} />
    </OverlayBusProvider>,
  );
  return { ...result, widget };
}

afterEach(() => {
  cleanup();
});

describe("ChatFeedRuntime", () => {
  it("renders no rows before any event fires", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);
    expect(container.querySelectorAll('[data-chat-row=""]').length).toBe(0);
  });

  it("adds a row for an emitted chat.message with display name + plain text", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);

    act(() => {
      bus.emit(makeChat({ plain: "gm chat" }));
    });

    const rows = container.querySelectorAll('[data-chat-row=""]');
    expect(rows.length).toBe(1);
    const row = rows[0]!;
    expect(row.querySelector('[data-display-name=""]')!.textContent).toBe("Alice");
    expect(row.textContent).toContain("gm chat");
  });

  it("keeps only the last `maxMessages` rows when more arrive", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ maxMessages: 3 }, bus);

    act(() => {
      for (let i = 0; i < 6; i += 1) {
        bus.emit(
          makeChat({
            id: `m${i}`,
            plain: `line-${i}`,
            fragments: [{ type: "text", text: `line-${i}` }],
          }),
        );
      }
    });

    const rows = container.querySelectorAll('[data-chat-row=""]');
    expect(rows.length).toBe(3);
    const texts = Array.from(rows).map((r) => r.textContent ?? "");
    // The last three (line-3, line-4, line-5) should remain — oldest dropped.
    expect(texts[0]).toContain("line-3");
    expect(texts[1]).toContain("line-4");
    expect(texts[2]).toContain("line-5");
    expect(texts.join(" ")).not.toContain("line-0");
    expect(texts.join(" ")).not.toContain("line-2");
  });

  it("uses the event's user.color when provided, otherwise hashes the login", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);

    act(() => {
      bus.emit(
        makeChat({
          id: "m-1",
          user: {
            id: "u1",
            login: "alice",
            displayName: "Alice",
            color: "#ff0000",
            roles: ["viewer"],
          },
        }),
      );
      bus.emit(
        makeChat({
          id: "m-2",
          user: {
            id: "u2",
            login: "bobthebuilder",
            displayName: "Bob",
            roles: ["viewer"],
          },
        }),
      );
    });

    const names = container.querySelectorAll('[data-display-name=""]');
    expect(names.length).toBe(2);
    // First message: explicit color wins. happy-dom preserves the
    // literal inline style string rather than normalizing to rgb().
    expect((names[0] as HTMLElement).style.color).toBe("#ff0000");
    // Second message: hash-derived HSL fallback.
    const bobColor = (names[1] as HTMLElement).style.color;
    expect(bobColor).toMatch(/^hsl\(\d+, 70%, 55%\)$/);
  });

  it("renders role badges with data-role attributes for broadcaster/moderator/vip/subscriber", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);

    act(() => {
      bus.emit(
        makeChat({
          id: "m-roles",
          user: {
            id: "u-roles",
            login: "everyone",
            displayName: "Everyone",
            roles: ["broadcaster", "mod", "vip", "subscriber"],
          },
        }),
      );
    });

    const badgeRoles = Array.from(container.querySelectorAll("[data-role]")).map((el) =>
      el.getAttribute("data-role"),
    );
    expect(badgeRoles).toEqual(["broadcaster", "moderator", "vip", "subscriber"]);
  });

  it("renders text + emote + mention fragments with expected markup", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ mentionColor: "#112233" }, bus);

    act(() => {
      bus.emit({
        kind: "chat.message",
        id: "m-frag",
        user: { id: "u", login: "alice", displayName: "Alice", roles: ["viewer"] },
        fragments: [
          { type: "text", text: "hey " },
          {
            type: "emote",
            text: "Kappa",
            emoteId: "25",
            emoteUrl: "https://example.test/kappa.png",
          },
          { type: "text", text: " " },
          { type: "mention", text: "@bob" },
        ],
        plain: "hey Kappa @bob",
        receivedAt: Date.now(),
      });
    });

    // Emote renders an <img> with the provided URL.
    const emoteImg = container.querySelector('[data-emote-id="25"]') as HTMLImageElement | null;
    expect(emoteImg).not.toBeNull();
    expect(emoteImg!.getAttribute("src")).toBe("https://example.test/kappa.png");
    expect(emoteImg!.getAttribute("alt")).toBe("Kappa");

    // Mention has inline color matching the mentionColor prop.
    const mention = container.querySelector('[data-mention=""]') as HTMLElement | null;
    expect(mention).not.toBeNull();
    expect(mention!.textContent).toBe("@bob");
    // happy-dom preserves the inline hex rather than normalizing.
    expect(mention!.style.color).toBe("#112233");
  });

  it("applies the fading class after `fadeAfterMs` when fade is enabled", () => {
    vi.useFakeTimers();
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ fadeAfterMs: 1000, fadeDurationMs: 500 }, bus);

    act(() => {
      bus.emit(makeChat({ id: "m-fade", plain: "bye" }));
    });

    // Immediately: row present, not yet fading.
    let row = container.querySelector('[data-chat-row=""]') as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row!.className).not.toMatch(/\bfading\b/);

    // After `fadeAfterMs` the row gets the fading class.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    row = container.querySelector('[data-chat-row=""]') as HTMLElement | null;
    expect(row).not.toBeNull();
    // CSS modules config sets classNameStrategy: "non-scoped" so the
    // `.fading` class name stays literal.
    expect(row!.className).toMatch(/fading/);

    // After the full fade duration, the row is removed from the DOM.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(container.querySelector('[data-chat-row=""]')).toBeNull();

    vi.useRealTimers();
  });

  it("reverses row order when `alignBottom` is false", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({ alignBottom: false }, bus);

    act(() => {
      bus.emit(
        makeChat({
          id: "m-a",
          plain: "first",
          fragments: [{ type: "text", text: "first" }],
        }),
      );
      bus.emit(
        makeChat({
          id: "m-b",
          plain: "second",
          fragments: [{ type: "text", text: "second" }],
        }),
      );
    });

    const rows = Array.from(container.querySelectorAll('[data-chat-row=""]'));
    expect(rows.length).toBe(2);
    // With alignBottom=false, newest (second) should render at the top.
    expect((rows[0] as HTMLElement).textContent).toContain("second");
    expect((rows[1] as HTMLElement).textContent).toContain("first");
  });
});

/**
 * A second suite to lock the default `alignBottom: true` ordering, using a
 * fresh bus so there's no cross-pollution with the fake-timer test above.
 */
describe("ChatFeedRuntime — default bottom-align ordering", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("renders newest at the bottom when alignBottom is true", () => {
    const bus = createEventBus<StreamEvent>();
    const { container } = renderWithBus({}, bus);

    act(() => {
      bus.emit(
        makeChat({
          id: "m-a",
          plain: "first",
          fragments: [{ type: "text", text: "first" }],
        }),
      );
      bus.emit(
        makeChat({
          id: "m-b",
          plain: "second",
          fragments: [{ type: "text", text: "second" }],
        }),
      );
    });

    const rows = Array.from(container.querySelectorAll('[data-chat-row=""]'));
    expect(rows.length).toBe(2);
    expect((rows[0] as HTMLElement).textContent).toContain("first");
    expect((rows[1] as HTMLElement).textContent).toContain("second");
  });
});
