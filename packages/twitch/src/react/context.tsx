import { createContext, useContext, type ReactNode } from "react";
import type { TwitchConnection } from "../connection";
import type { RewardsClient } from "../rewards/client";

/**
 * Shared React context exposing a `TwitchConnection` instance + optional
 * test-injection seams. Apps wrap the tree with `<TwitchConnectionProvider>`
 * to make connection-aware hooks (like `useRewards`) reachable.
 *
 * The `rewardsClientFactory` slot lets tests swap in a stub `RewardsClient`
 * without mocking the module system. App code normally leaves it undefined
 * so the hook constructs a real client from the connection's token.
 */
export interface TwitchConnectionContextValue {
  connection: TwitchConnection;
  /** Override the default clientId resolution (falls back to env). */
  clientId?: string;
  /**
   * Optional test override — returns a stub RewardsClient. Takes the
   * loosely-typed connection shape so tests can pass stand-in objects
   * without extending the full `TwitchConnection` surface.
   */
  rewardsClientFactory?: (connection: unknown) => RewardsClient | null;
}

const TwitchConnectionContext = createContext<TwitchConnectionContextValue | null>(null);

export interface TwitchConnectionProviderProps extends TwitchConnectionContextValue {
  children: ReactNode;
}

/**
 * Provider that exposes a single shared `TwitchConnection` to hooks below
 * it. App code typically mounts this at the root next to the main layout
 * and threads the connection via the returned context.
 */
export function TwitchConnectionProvider({
  connection,
  clientId,
  rewardsClientFactory,
  children,
}: TwitchConnectionProviderProps) {
  return (
    <TwitchConnectionContext.Provider value={{ connection, clientId, rewardsClientFactory }}>
      {children}
    </TwitchConnectionContext.Provider>
  );
}

/**
 * Low-level accessor for the connection context. Returns null when no
 * provider is mounted — hooks layered on top of this (like `useRewards`)
 * use the nullable return to degrade gracefully.
 */
export function useTwitchConnectionContext(): TwitchConnectionContextValue | null {
  return useContext(TwitchConnectionContext);
}
