import { describe, expect, it } from "vitest";
import { parseEventSubMessage } from "../messages";

function metadata(type: string) {
  return {
    message_id: "m-1",
    message_timestamp: "2024-01-01T00:00:00Z",
    message_type: type,
  };
}

describe("parseEventSubMessage", () => {
  it("parses session_welcome", () => {
    const msg = parseEventSubMessage(
      JSON.stringify({
        metadata: metadata("session_welcome"),
        payload: {
          session: {
            id: "sess-1",
            status: "connected",
            keepalive_timeout_seconds: 10,
            reconnect_url: null,
            connected_at: "2024-01-01T00:00:00Z",
          },
        },
      }),
    );
    expect(msg).not.toBeNull();
    expect(msg!.metadata.message_type).toBe("session_welcome");
    expect((msg as { payload: { session: { id: string } } }).payload.session.id).toBe("sess-1");
  });

  it("parses session_keepalive", () => {
    const msg = parseEventSubMessage(
      JSON.stringify({
        metadata: metadata("session_keepalive"),
        payload: {},
      }),
    );
    expect(msg!.metadata.message_type).toBe("session_keepalive");
  });

  it("parses session_reconnect", () => {
    const msg = parseEventSubMessage(
      JSON.stringify({
        metadata: metadata("session_reconnect"),
        payload: {
          session: {
            id: "sess-1",
            status: "reconnecting",
            keepalive_timeout_seconds: 10,
            reconnect_url: "wss://other",
            connected_at: "2024-01-01T00:00:00Z",
          },
        },
      }),
    );
    expect(
      (msg as { payload: { session: { reconnect_url: string } } }).payload.session.reconnect_url,
    ).toBe("wss://other");
  });

  it("parses notification", () => {
    const msg = parseEventSubMessage(
      JSON.stringify({
        metadata: {
          ...metadata("notification"),
          subscription_type: "channel.follow",
          subscription_version: "2",
        },
        payload: {
          subscription: {
            id: "sub-1",
            type: "channel.follow",
            version: "2",
            status: "enabled",
            created_at: "2024-01-01T00:00:00Z",
          },
          event: { foo: "bar" },
        },
      }),
    );
    expect(msg!.metadata.message_type).toBe("notification");
  });

  it("parses revocation", () => {
    const msg = parseEventSubMessage(
      JSON.stringify({
        metadata: {
          ...metadata("revocation"),
          subscription_type: "channel.follow",
          subscription_version: "2",
        },
        payload: {
          subscription: {
            id: "sub-1",
            status: "authorization_revoked",
            type: "channel.follow",
            version: "2",
          },
        },
      }),
    );
    expect(msg!.metadata.message_type).toBe("revocation");
  });

  it("returns null for unknown message types", () => {
    const msg = parseEventSubMessage(
      JSON.stringify({
        metadata: metadata("session_future_thing"),
        payload: {},
      }),
    );
    expect(msg).toBeNull();
  });

  it("throws on malformed session_welcome", () => {
    expect(() =>
      parseEventSubMessage(
        JSON.stringify({
          metadata: metadata("session_welcome"),
          payload: {
            session: {
              // missing required fields
              id: "sess-1",
            },
          },
        }),
      ),
    ).toThrow();
  });

  it("throws on invalid JSON", () => {
    expect(() => parseEventSubMessage("not-json")).toThrow();
  });
});
