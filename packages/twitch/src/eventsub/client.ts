import type { StreamEvent } from "@obs/core";
import { EVENTSUB_WS_URL } from "../config";
import type { HelixClient } from "../helix";
import {
  parseEventSubMessage,
  type NotificationMessage,
  type RevocationMessage,
  type SessionReconnectMessage,
  type SessionWelcomeMessage,
} from "./messages";
import { normalizeNotification } from "./normalize";
import { createSubscriptions, type EventSubType } from "./subscriptions";

export type EventSubStatus =
  | "idle"
  | "connecting"
  | "welcomed"
  | "subscribing"
  | "active"
  | "reconnecting"
  | "failed"
  | "disconnected";

export interface EventSubEvent {
  type: "status" | "event" | "error" | "revocation";
  status?: EventSubStatus;
  event?: StreamEvent;
  error?: Error;
  subscriptionType?: string;
}

/**
 * Abstraction over the global WebSocket constructor. Exposed so the tests
 * can pass a fake implementation without monkey-patching globals.
 */
export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "close", listener: () => void): void;
  addEventListener(type: "error", listener: (err: unknown) => void): void;
  addEventListener(type: "message", listener: (ev: { data: string }) => void): void;
  removeEventListener(type: string, listener: (...args: unknown[]) => void): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export interface CreateEventSubClientOptions {
  helix: HelixClient;
  /** broadcaster_user_id — which channel's events we subscribe to. */
  channelUserId: string;
  /** user_id of the authenticated user (required for chat sub condition). */
  selfUserId: string;
  /** Subscription types to create on connect. */
  subscribe: EventSubType[];
  /** Override the ws URL for tests. Defaults to the Twitch EventSub URL. */
  wsUrl?: string;
  /** Override the ws factory for tests. */
  wsFactory?: WebSocketFactory;
}

export interface EventSubClientApi {
  connect(): Promise<void>;
  disconnect(): void;
  readonly status: EventSubStatus;
  onStatusChange(fn: (s: EventSubStatus) => void): () => void;
  onEvent(fn: (e: StreamEvent) => void): () => void;
  onError(fn: (err: Error) => void): () => void;
}

const defaultFactory: WebSocketFactory = (url) => new WebSocket(url) as unknown as WebSocketLike;

/**
 * EventSub WebSocket client. Manages session lifecycle (welcome →
 * subscribing → active → reconnect) and normalizes notifications into
 * `StreamEvent`s. The state machine lives entirely inside this closure so
 * a reconnect cycle can't leak listeners from the old socket into the new.
 */
export function createEventSubClient(opts: CreateEventSubClientOptions): EventSubClientApi {
  const factory = opts.wsFactory ?? defaultFactory;
  const wsUrl = opts.wsUrl ?? EVENTSUB_WS_URL;

  let status: EventSubStatus = "idle";
  let currentSocket: WebSocketLike | null = null;
  /**
   * During a session_reconnect handoff we briefly have two sockets: the
   * old one (still active until we receive a welcome on the new) and the
   * new one. Stored here so disconnect() can close both without
   * ambiguity.
   */
  let pendingSocket: WebSocketLike | null = null;
  let keepaliveTimer: ReturnType<typeof setTimeout> | null = null;
  let keepaliveSeconds = 10;
  let disposed = false;
  let sessionId: string | null = null;

  const statusListeners = new Set<(s: EventSubStatus) => void>();
  const eventListeners = new Set<(e: StreamEvent) => void>();
  const errorListeners = new Set<(err: Error) => void>();

  const setStatus = (next: EventSubStatus) => {
    if (status === next) return;
    status = next;
    for (const l of [...statusListeners]) l(next);
  };

  const emitEvent = (e: StreamEvent) => {
    for (const l of [...eventListeners]) l(e);
  };

  const emitError = (err: Error) => {
    for (const l of [...errorListeners]) l(err);
  };

  const resetKeepalive = () => {
    if (keepaliveTimer) clearTimeout(keepaliveTimer);
    // Twitch guarantees a keepalive within `keepalive_timeout_seconds`; we
    // give a 5-second grace buffer before assuming the socket is dead.
    keepaliveTimer = setTimeout(
      () => {
        emitError(new Error("EventSub keepalive timeout — reconnecting"));
        reconnect();
      },
      (keepaliveSeconds + 5) * 1000,
    );
  };

  const clearKeepalive = () => {
    if (keepaliveTimer) {
      clearTimeout(keepaliveTimer);
      keepaliveTimer = null;
    }
  };

  const teardownSocket = (socket: WebSocketLike | null) => {
    if (!socket) return;
    try {
      socket.close();
    } catch {
      // ignore
    }
  };

  const reconnect = () => {
    if (disposed) return;
    setStatus("reconnecting");
    teardownSocket(currentSocket);
    currentSocket = null;
    sessionId = null;
    clearKeepalive();
    // Kick off a fresh connection attempt.
    connect().catch((err) => emitError(err as Error));
  };

  const handleMessage = async (raw: string) => {
    let message: ReturnType<typeof parseEventSubMessage>;
    try {
      message = parseEventSubMessage(raw);
    } catch (err) {
      emitError(err as Error);
      return;
    }
    if (!message) return;

    resetKeepalive();

    // TS cannot narrow the union through `message.metadata.message_type`
    // because the metadata objects are structurally different per variant.
    // Branch on the literal and cast to the concrete sub-type — the zod
    // parse above guarantees the shape.
    const type = message.metadata.message_type;
    if (type === "session_welcome") {
      const welcome = message as SessionWelcomeMessage;
      sessionId = welcome.payload.session.id;
      keepaliveSeconds = welcome.payload.session.keepalive_timeout_seconds ?? 10;
      resetKeepalive();
      setStatus("welcomed");
      setStatus("subscribing");
      const { failed } = await createSubscriptions(opts.helix, opts.subscribe, {
        sessionId,
        channelUserId: opts.channelUserId,
        selfUserId: opts.selfUserId,
      });
      for (const f of failed) {
        emitError(new Error(`Failed to subscribe to ${f.type}: ${f.error.message}`));
      }
      // Even if some subscriptions failed we consider the connection
      // active — partial coverage is better than none. If every
      // subscription failed, mark failed instead.
      if (failed.length === opts.subscribe.length && opts.subscribe.length > 0) {
        setStatus("failed");
      } else {
        setStatus("active");
      }
    } else if (type === "session_keepalive") {
      // Timer already reset above; nothing else to do.
    } else if (type === "session_reconnect") {
      const reconnectMsg = message as SessionReconnectMessage;
      const newUrl = reconnectMsg.payload.session.reconnect_url;
      try {
        const next = factory(newUrl);
        pendingSocket = next;
        attachListeners(next, {
          isPending: true,
          onWelcome: () => {
            // Swap sockets: close the old one and promote pending.
            teardownSocket(currentSocket);
            currentSocket = next;
            pendingSocket = null;
          },
        });
      } catch (err) {
        emitError(err as Error);
      }
    } else if (type === "notification") {
      const notif = message as NotificationMessage;
      const normalized = normalizeNotification(notif);
      if (normalized) emitEvent(normalized);
    } else if (type === "revocation") {
      const rev = message as RevocationMessage;
      emitError(
        new Error(
          `Subscription revoked: ${rev.payload.subscription.type} (${rev.payload.subscription.status})`,
        ),
      );
      // Chat being revoked is a hard failure for overlays that expect a
      // chat-sub; other revocations still leave the socket usable.
      if (rev.payload.subscription.type === "channel.chat.message") {
        setStatus("failed");
      }
    }
  };

  interface AttachOptions {
    isPending?: boolean;
    onWelcome?: () => void;
  }

  /**
   * Wire a socket to the current handlers. `isPending` sockets are part
   * of a reconnect handoff — they don't become "currentSocket" until
   * their welcome fires.
   */
  const attachListeners = (socket: WebSocketLike, attach: AttachOptions = {}) => {
    const onOpen = () => {
      if (!attach.isPending) {
        setStatus("connecting");
      }
    };
    const onClose = () => {
      if (disposed) return;
      if (socket === currentSocket || socket === pendingSocket) {
        setStatus("reconnecting");
        reconnect();
      }
    };
    const onError = (err: unknown) => {
      emitError(err instanceof Error ? err : new Error(`EventSub socket error: ${String(err)}`));
    };
    const onMessage = (ev: { data: string }) => {
      // If this is a pending socket waiting for its welcome, promote it
      // before dispatching so downstream logic sees a consistent state.
      if (attach.isPending) {
        let pre: ReturnType<typeof parseEventSubMessage> = null;
        try {
          pre = parseEventSubMessage(ev.data);
        } catch {
          // falls through to handleMessage which will report the error
        }
        if (pre && pre.metadata.message_type === "session_welcome") {
          attach.onWelcome?.();
          attach.isPending = false;
        }
      }
      void handleMessage(ev.data);
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("close", onClose);
    socket.addEventListener("error", onError as (err: unknown) => void);
    socket.addEventListener("message", onMessage);
  };

  async function connect(): Promise<void> {
    if (disposed) return;
    setStatus("connecting");
    const socket = factory(wsUrl);
    currentSocket = socket;
    attachListeners(socket);
  }

  return {
    async connect() {
      disposed = false;
      await connect();
    },
    disconnect() {
      disposed = true;
      clearKeepalive();
      teardownSocket(currentSocket);
      teardownSocket(pendingSocket);
      currentSocket = null;
      pendingSocket = null;
      setStatus("disconnected");
    },
    get status() {
      return status;
    },
    onStatusChange(fn) {
      statusListeners.add(fn);
      return () => statusListeners.delete(fn) as unknown as void;
    },
    onEvent(fn) {
      eventListeners.add(fn);
      return () => eventListeners.delete(fn) as unknown as void;
    },
    onError(fn) {
      errorListeners.add(fn);
      return () => errorListeners.delete(fn) as unknown as void;
    },
  };
}

/**
 * Class-style export matching the task spec. Thin wrapper over
 * `createEventSubClient` so both call styles work.
 */
export class EventSubClientImpl implements EventSubClientApi {
  private readonly impl: EventSubClientApi;
  constructor(opts: CreateEventSubClientOptions) {
    this.impl = createEventSubClient(opts);
  }
  connect() {
    return this.impl.connect();
  }
  disconnect() {
    this.impl.disconnect();
  }
  get status() {
    return this.impl.status;
  }
  onStatusChange(fn: (s: EventSubStatus) => void) {
    return this.impl.onStatusChange(fn);
  }
  onEvent(fn: (e: StreamEvent) => void) {
    return this.impl.onEvent(fn);
  }
  onError(fn: (err: Error) => void) {
    return this.impl.onError(fn);
  }
}

export { EventSubClientImpl as EventSubClient };
