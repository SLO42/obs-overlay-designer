import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@obs/core";
import { fireEvent, overlayBus } from "../bus";

function makeChat(id: string, text = "hi"): ChatMessage {
  return {
    kind: "chat.message",
    id,
    user: {
      id: "u1",
      login: "alice",
      displayName: "Alice",
      roles: ["viewer"],
    },
    fragments: [{ type: "text", text }],
    plain: text,
    receivedAt: Date.now(),
  };
}

describe("overlayBus", () => {
  it("publish/subscribe round-trips a chat.message event", () => {
    const spy = vi.fn();
    const off = overlayBus.on(spy);
    try {
      fireEvent(makeChat("e1"));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]![0].kind).toBe("chat.message");
    } finally {
      off();
    }
  });

  it("unsubscribe stops future events reaching the listener", () => {
    const spy = vi.fn();
    const off = overlayBus.on(spy);
    fireEvent(makeChat("e2"));
    off();
    fireEvent(makeChat("e3"));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
