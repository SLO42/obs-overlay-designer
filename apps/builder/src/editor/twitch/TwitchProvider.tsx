import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { TwitchConnection } from "@obs/twitch";

interface TwitchProviderValue {
  connection: TwitchConnection;
}

const TwitchContext = createContext<TwitchProviderValue | null>(null);

/**
 * App-level provider that owns a single `TwitchConnection` instance. We
 * deliberately keep this out of the zustand editor store — the connection
 * has side-effectful lifecycle (timers, sockets) that doesn't serialize
 * into the history stack cleanly.
 *
 * The instance is lazily created on mount and torn down on unmount so HMR
 * in dev doesn't leak sockets / popups.
 */
export function TwitchProvider({ children }: { children: ReactNode }) {
  const connRef = useRef<TwitchConnection | null>(null);
  if (connRef.current === null) {
    connRef.current = new TwitchConnection();
  }

  // Attempt a silent restore on mount. Swallows errors — this is best-effort
  // and the UI surfaces "Not connected" if it fails.
  useEffect(() => {
    const conn = connRef.current;
    if (!conn) return;
    let active = true;
    conn.restore().catch(() => {
      if (!active) return;
      // Non-fatal; logged only.
      console.warn("[twitch] silent restore failed");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      connRef.current?.disconnect();
    };
  }, []);

  const value = useMemo<TwitchProviderValue>(() => ({ connection: connRef.current! }), []);

  return <TwitchContext.Provider value={value}>{children}</TwitchContext.Provider>;
}

/** Hook: grab the shared connection. Throws if used outside the provider. */
export function useTwitchContext(): TwitchProviderValue {
  const ctx = useContext(TwitchContext);
  if (!ctx) {
    throw new Error("useTwitchContext must be used inside <TwitchProvider>");
  }
  return ctx;
}
