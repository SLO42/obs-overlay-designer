import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HelixClient } from "../../helix";
import { createEventSubClient, type WebSocketLike } from "../client";

/**
 * A minimal fake WebSocket. Tests drive it by calling .emitOpen() /
 * .emitMessage() / .emitClose() on the returned instance; this mirrors
 * real-browser event dispatch without pulling in a full ws shim.
 */
class FakeSocket {
  readyState = 0;
  closed = false;
  url: string;
  private listeners = new Map<string, Array<(arg: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
  }
  addEventListener(type: string, listener: (...args: unknown[]) => void): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(listener as (arg: unknown) => void);
    this.listeners.set(type, arr);
  }
  removeEventListener(type: string, listener: (...args: unknown[]) => void): void {
    const arr = this.listeners.get(type);
    if (!arr) return;
    const idx = arr.indexOf(listener as (arg: unknown) => void);
    if (idx !== -1) arr.splice(idx, 1);
  }
  send(_data: string): void {
    // no-op
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.readyState = 3;
    this.emit("close", undefined);
  }

  emit(type: string, arg: unknown) {
    const arr = this.listeners.get(type);
    if (!arr) return;
    for (const l of [...arr]) l(arg);
  }
  emitOpen() {
    this.readyState = 1;
    this.emit("open", undefined);
  }
  emitMessage(data: unknown) {
    this.emit("message", { data: typeof data === "string" ? data : JSON.stringify(data) });
  }
  emitError(err: unknown) {
    this.emit("error", err);
  }
}

function welcomeMessage(keepalive = 10) {
  return {
    metadata: {
      message_id: "m-welcome",
      message_timestamp: "2024-01-01T00:00:00Z",
      message_type: "session_welcome",
    },
    payload: {
      session: {
        id: "sess-1",
        status: "connected",
        keepalive_timeout_seconds: keepalive,
        reconnect_url: null,
        connected_at: "2024-01-01T00:00:00Z",
      },
    },
  };
}

function keepaliveMessage() {
  return {
    metadata: {
      message_id: "m-ka",
      message_timestamp: "2024-01-01T00:00:01Z",
      message_type: "session_keepalive",
    },
    payload: {},
  };
}

function followNotification() {
  return {
    metadata: {
      message_id: "m-notif",
      message_timestamp: "2024-01-01T00:00:02Z",
      message_type: "notification",
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
      event: {
        user_id: "42",
        user_login: "viewer",
        user_name: "Viewer",
        broadcaster_user_id: "1",
        followed_at: "2024-01-01T00:00:00Z",
      },
    },
  };
}

function revocationMessage(type: string) {
  return {
    metadata: {
      message_id: "m-rev",
      message_timestamp: "2024-01-01T00:00:03Z",
      message_type: "revocation",
      subscription_type: type,
      subscription_version: "1",
    },
    payload: {
      subscription: {
        id: "sub-1",
        status: "authorization_revoked",
        type,
        version: "1",
      },
    },
  };
}

function reconnectMessage(url: string) {
  return {
    metadata: {
      message_id: "m-rc",
      message_timestamp: "2024-01-01T00:00:04Z",
      message_type: "session_reconnect",
    },
    payload: {
      session: {
        id: "sess-2",
        status: "reconnecting",
        keepalive_timeout_seconds: 10,
        reconnect_url: url,
        connected_at: "2024-01-01T00:00:00Z",
      },
    },
  };
}

function makeHelix(): HelixClient & {
  posts: Array<{ path: string; body: unknown }>;
} {
  const posts: Array<{ path: string; body: unknown }> = [];
  const helix: HelixClient = {
    async get() {
      return {} as never;
    },
    async post(path, body) {
      posts.push({ path, body });
      return {} as never;
    },
    async patch() {
      return {} as never;
    },
    async delete() {
      return;
    },
  };
  return Object.assign(helix, { posts });
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("EventSubClient state machine", () => {
  it("welcomes, subscribes, and becomes active", async () => {
    const helix = makeHelix();
    const sockets: FakeSocket[] = [];
    const client = createEventSubClient({
      helix,
      channelUserId: "100",
      selfUserId: "42",
      subscribe: ["channel.follow"],
      wsFactory: (url) => {
        const s = new FakeSocket(url);
        sockets.push(s);
        return s as unknown as WebSocketLike;
      },
    });
    const statuses: string[] = [];
    client.onStatusChange((s) => statuses.push(s));

    await client.connect();
    expect(sockets).toHaveLength(1);

    const sock = sockets[0]!;
    sock.emitOpen();
    sock.emitMessage(welcomeMessage());

    // Let the subscribe microtasks drain.
    // Flush microtasks so pending subscription POSTs resolve, without
    // advancing wall-clock time (otherwise the keepalive watchdog fires
    // and the test sees a reconnect we didn't ask for).
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }

    expect(helix.posts).toHaveLength(1);
    expect((helix.posts[0]!.body as { type: string }).type).toBe("channel.follow");
    expect(statuses).toContain("active");
  });

  it("emits normalized events on notification", async () => {
    const helix = makeHelix();
    let fake: FakeSocket | null = null;
    const client = createEventSubClient({
      helix,
      channelUserId: "100",
      selfUserId: "42",
      subscribe: ["channel.follow"],
      wsFactory: (url) => {
        fake = new FakeSocket(url);
        return fake! as unknown as WebSocketLike;
      },
    });
    const events: Array<{ kind: string }> = [];
    client.onEvent((e) => events.push({ kind: e.kind }));

    await client.connect();
    fake!.emitOpen();
    fake!.emitMessage(welcomeMessage());
    // Flush microtasks so pending subscription POSTs resolve, without
    // advancing wall-clock time (otherwise the keepalive watchdog fires
    // and the test sees a reconnect we didn't ask for).
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
    fake!.emitMessage(followNotification());

    expect(events).toEqual([{ kind: "channel.follow" }]);
  });

  it("keepalive resets the idle timer (no reconnect for a second socket)", async () => {
    const helix = makeHelix();
    const sockets: FakeSocket[] = [];
    const client = createEventSubClient({
      helix,
      channelUserId: "100",
      selfUserId: "42",
      subscribe: [],
      wsFactory: (url) => {
        const s = new FakeSocket(url);
        sockets.push(s);
        return s as unknown as WebSocketLike;
      },
    });
    await client.connect();
    const first = sockets[0]!;
    first.emitOpen();
    first.emitMessage(welcomeMessage(10));

    // Advance within the keepalive window, push a keepalive.
    vi.advanceTimersByTime(12_000);
    first.emitMessage(keepaliveMessage());
    // Keep going — past the original deadline but the timer was reset.
    vi.advanceTimersByTime(10_000);
    // Only one socket should have been created.
    expect(sockets).toHaveLength(1);
  });

  it("reconnects to a new URL on session_reconnect", async () => {
    const helix = makeHelix();
    const sockets: FakeSocket[] = [];
    const client = createEventSubClient({
      helix,
      channelUserId: "100",
      selfUserId: "42",
      subscribe: [],
      wsFactory: (url) => {
        const s = new FakeSocket(url);
        sockets.push(s);
        return s as unknown as WebSocketLike;
      },
    });
    await client.connect();
    const first = sockets[0]!;
    first.emitOpen();
    first.emitMessage(welcomeMessage());
    // Flush microtasks so pending subscription POSTs resolve, without
    // advancing wall-clock time (otherwise the keepalive watchdog fires
    // and the test sees a reconnect we didn't ask for).
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }

    first.emitMessage(reconnectMessage("wss://reconnect.example/ws"));

    expect(sockets).toHaveLength(2);
    expect(sockets[1]!.url).toBe("wss://reconnect.example/ws");

    // Promote via welcome on the new socket.
    sockets[1]!.emitOpen();
    sockets[1]!.emitMessage(welcomeMessage());

    // First socket should be closed.
    expect(first.closed).toBe(true);
  });

  it("bubbles an error on revocation and marks failed for chat", async () => {
    const helix = makeHelix();
    const sockets: FakeSocket[] = [];
    const client = createEventSubClient({
      helix,
      channelUserId: "100",
      selfUserId: "42",
      subscribe: [],
      wsFactory: (url) => {
        const s = new FakeSocket(url);
        sockets.push(s);
        return s as unknown as WebSocketLike;
      },
    });
    const errors: Error[] = [];
    client.onError((e) => errors.push(e));
    const statuses: string[] = [];
    client.onStatusChange((s) => statuses.push(s));

    await client.connect();
    sockets[0]!.emitOpen();
    sockets[0]!.emitMessage(welcomeMessage());
    // Flush microtasks so pending subscription POSTs resolve, without
    // advancing wall-clock time (otherwise the keepalive watchdog fires
    // and the test sees a reconnect we didn't ask for).
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }

    sockets[0]!.emitMessage(revocationMessage("channel.chat.message"));
    expect(errors.some((e) => e.message.includes("revoked"))).toBe(true);
    expect(statuses).toContain("failed");
  });

  it("disconnect() closes the socket and stops timers", async () => {
    const helix = makeHelix();
    const sockets: FakeSocket[] = [];
    const client = createEventSubClient({
      helix,
      channelUserId: "100",
      selfUserId: "42",
      subscribe: [],
      wsFactory: (url) => {
        const s = new FakeSocket(url);
        sockets.push(s);
        return s as unknown as WebSocketLike;
      },
    });
    await client.connect();
    sockets[0]!.emitOpen();
    sockets[0]!.emitMessage(welcomeMessage());
    // Flush microtasks so pending subscription POSTs resolve, without
    // advancing wall-clock time (otherwise the keepalive watchdog fires
    // and the test sees a reconnect we didn't ask for).
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }

    client.disconnect();
    expect(sockets[0]!.closed).toBe(true);
    expect(client.status).toBe("disconnected");
  });
});
