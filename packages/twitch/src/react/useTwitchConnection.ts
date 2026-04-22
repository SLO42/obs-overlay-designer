import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StreamEvent } from "@obs/core";
import { TwitchConnection, type ConnectionStatus } from "../connection";
import type { EventSubType } from "../eventsub/subscriptions";

export interface UseTwitchConnectionOptions {
  clientId?: string;
  redirectUri?: string;
  /** If undefined, uses the authenticated user's own login. */
  channelLogin?: string;
  subscribe: EventSubType[];
  /** Attempt `restore()` on mount. Default true. */
  autoRestore?: boolean;
}

export interface UseTwitchConnectionResult {
  status: ConnectionStatus;
  login: string | null;
  userId: string | null;
  channelLogin: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  onEvent: (fn: (e: StreamEvent) => void) => () => void;
  error: Error | null;
}

/**
 * React wrapper around `TwitchConnection`. The connection instance is
 * memoized on `clientId` — switching apps at runtime will create a new
 * instance and tear the old one down. Status/login/userId are mirrored
 * into React state via the connection's listeners.
 */
export function useTwitchConnection(
  options: UseTwitchConnectionOptions,
): UseTwitchConnectionResult {
  const { clientId, redirectUri, channelLogin, subscribe, autoRestore = true } = options;

  // Memo by clientId *and* redirectUri — the factory is cheap, but the
  // underlying connection keeps listeners and we don't want stale ones.
  const connection = useMemo(
    () => new TwitchConnection({ clientId, redirectUri }),
    [clientId, redirectUri],
  );

  const [status, setStatus] = useState<ConnectionStatus>(connection.status);
  const [login, setLogin] = useState<string | null>(connection.userLogin);
  const [userId, setUserId] = useState<string | null>(connection.userId);
  const [channelLoginState, setChannelLogin] = useState<string | null>(connection.channelLogin);
  const [error, setError] = useState<Error | null>(null);

  // Keep subscribe/channelLogin fresh for the imperative connect() without
  // breaking memoization of the connection instance itself.
  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;
  const channelRef = useRef(channelLogin);
  channelRef.current = channelLogin;

  useEffect(() => {
    const offStatus = connection.onStatusChange((s) => {
      setStatus(s);
      setLogin(connection.userLogin);
      setUserId(connection.userId);
      setChannelLogin(connection.channelLogin);
    });
    const offError = connection.onError((err) => setError(err));
    return () => {
      offStatus();
      offError();
    };
  }, [connection]);

  useEffect(() => {
    if (!autoRestore) return;
    let cancelled = false;
    connection.restore().then((ok) => {
      if (cancelled) return;
      if (ok) {
        setLogin(connection.userLogin);
        setUserId(connection.userId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [connection, autoRestore]);

  useEffect(() => {
    return () => {
      connection.disconnect();
    };
  }, [connection]);

  const connect = useCallback(async () => {
    setError(null);
    try {
      await connection.connect({
        channelLogin: channelRef.current,
        subscribe: subscribeRef.current,
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [connection]);

  const disconnect = useCallback(() => {
    connection.disconnect();
  }, [connection]);

  const onEvent = useCallback(
    (fn: (e: StreamEvent) => void) => {
      return connection.onEvent(fn);
    },
    [connection],
  );

  return {
    status,
    login,
    userId,
    channelLogin: channelLoginState,
    connect,
    disconnect,
    onEvent,
    error,
  };
}
