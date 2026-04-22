import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getClientId } from "../config";
import { TwitchConnection } from "../connection";
import { createHelixClient } from "../helix";
import { createRewardsClient, type RewardsClient } from "../rewards/client";
import type { CreateRewardBody, CustomReward, UpdateRewardBody } from "../rewards/types";
import { useTwitchConnectionContext } from "./context";

/** Minimal subset of the TwitchConnection the hook reads. Export so the hook is testable. */
interface ConnectionLike {
  status: TwitchConnection["status"];
  token: string | null;
  channelUserId: string | null;
  scopes: string[];
  onStatusChange(fn: (s: TwitchConnection["status"]) => void): () => void;
}

export interface UseRewardsResult {
  /** `null` until the first list() resolves. Empty array = zero rewards on the channel. */
  rewards: CustomReward[] | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  create: (body: CreateRewardBody) => Promise<CustomReward>;
  update: (id: string, body: UpdateRewardBody) => Promise<CustomReward>;
  remove: (id: string) => Promise<void>;
  /**
   * True when the connection is active AND the token carries
   * `channel:read:redemptions`. Mutations separately require
   * `channel:manage:redemptions`; callers should inspect `canManage`.
   */
  available: boolean;
  /** True only when the token also carries `channel:manage:redemptions`. */
  canManage: boolean;
}

export interface UseRewardsOptions {
  /** Optional explicit connection — otherwise pulled from context. */
  connection?: ConnectionLike;
  /** Optional explicit clientId — otherwise pulled from context / env. */
  clientId?: string;
  /**
   * Optional test override: returns a `RewardsClient` bound to the given
   * connection. When present, skips the normal createHelixClient dance.
   * Takes `unknown` so tests can pass stand-in connection objects.
   */
  rewardsClientFactory?: (connection: unknown) => RewardsClient | null;
}

const SCOPE_READ = "channel:read:redemptions";
const SCOPE_MANAGE = "channel:manage:redemptions";

/**
 * React hook exposing Helix CRUD over the authenticated broadcaster's
 * custom channel-point rewards. Pulls the shared `TwitchConnection` from
 * `<TwitchConnectionProvider>` when no `connection` option is provided.
 *
 * Behaviour:
 *  - `available` reflects connection status + read scope.
 *  - Mutations refuse with a readable error when the manage scope is missing.
 *  - `list()` is called automatically whenever `available` flips to true.
 *  - `reload()` is exposed for post-mutation refresh (we don't optimistically
 *    update — the broadcaster's local list diverges quickly if Helix errors).
 */
export function useRewards(options: UseRewardsOptions = {}): UseRewardsResult {
  const ctx = useTwitchConnectionContext();
  const connection = (options.connection ?? ctx?.connection) as ConnectionLike | undefined;
  const clientIdOpt = options.clientId ?? ctx?.clientId;
  const factoryOpt = options.rewardsClientFactory ?? ctx?.rewardsClientFactory;

  const [rewards, setRewards] = useState<CustomReward[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Mirror connection state into React so UI re-renders on status changes.
  const [status, setStatus] = useState<TwitchConnection["status"]>(connection?.status ?? "idle");
  useEffect(() => {
    if (!connection) return;
    setStatus(connection.status);
    const off = connection.onStatusChange((s) => setStatus(s));
    return off;
  }, [connection]);

  const scopes = connection?.scopes ?? [];
  const hasRead = scopes.includes(SCOPE_READ);
  const hasManage = scopes.includes(SCOPE_MANAGE);
  const available =
    status === "active" && !!connection?.token && !!connection?.channelUserId && hasRead;

  const clientRef = useRef<RewardsClient | null>(null);
  // Build the RewardsClient lazily. We memoize on the ids that matter —
  // refresh token rotations will surface as a new token string.
  const rewardsClient = useMemo<RewardsClient | null>(() => {
    if (!connection || !connection.token || !connection.channelUserId) {
      clientRef.current = null;
      return null;
    }
    if (factoryOpt) {
      const c = factoryOpt(connection);
      clientRef.current = c;
      return c;
    }
    // Fall back to a real Helix-backed client. `getClientId` may throw in
    // test environments without env wiring; we swallow that into an error
    // state rather than crashing the render.
    try {
      const clientId = clientIdOpt ?? getClientId();
      const helix = createHelixClient({ clientId, token: connection.token });
      const client = createRewardsClient(helix, connection.channelUserId, clientId);
      clientRef.current = client;
      return client;
    } catch (err) {
      // Surface config errors as a non-fatal hook error; the UI renders a
      // "not configured" state. Throwing here would break the entire tree.
      setError(err as Error);
      clientRef.current = null;
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    connection,
    connection?.token,
    connection?.channelUserId,
    connection?.status,
    clientIdOpt,
    factoryOpt,
  ]);

  /** Fetch the current list. Safe to call repeatedly; no-op without a client. */
  const reload = useCallback(async () => {
    const client = clientRef.current ?? rewardsClient;
    if (!client || !available) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await client.list();
      setRewards(next);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [rewardsClient, available]);

  // Auto-load on availability flip. We intentionally DON'T re-run on every
  // token rotation — we'd double-fetch during token refresh bursts.
  useEffect(() => {
    if (!available) {
      setRewards(null);
      return;
    }
    void reload();
  }, [available, reload]);

  const assertManage = useCallback(() => {
    if (!hasManage) {
      throw new Error(
        "Reconnect Twitch and grant 'channel:manage:redemptions' to create / update / delete rewards.",
      );
    }
  }, [hasManage]);

  const create = useCallback(
    async (body: CreateRewardBody) => {
      const client = clientRef.current ?? rewardsClient;
      if (!client) throw new Error("Twitch rewards client unavailable — not connected.");
      assertManage();
      const created = await client.create(body);
      await reload();
      return created;
    },
    [rewardsClient, assertManage, reload],
  );

  const update = useCallback(
    async (id: string, body: UpdateRewardBody) => {
      const client = clientRef.current ?? rewardsClient;
      if (!client) throw new Error("Twitch rewards client unavailable — not connected.");
      assertManage();
      const updated = await client.update(id, body);
      await reload();
      return updated;
    },
    [rewardsClient, assertManage, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      const client = clientRef.current ?? rewardsClient;
      if (!client) throw new Error("Twitch rewards client unavailable — not connected.");
      assertManage();
      await client.remove(id);
      await reload();
    },
    [rewardsClient, assertManage, reload],
  );

  return {
    rewards,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    available,
    canManage: hasManage,
  };
}
