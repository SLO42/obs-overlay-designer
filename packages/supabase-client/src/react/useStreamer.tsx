import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  callCreateConnectLink,
  callEnsureStreamer,
  callGetConnectStatus,
  type ConnectStatus,
  type StreamerPublic,
  type SupabaseFunctionsConfig,
} from "../streamer";

/**
 * Value surface for consumers. The provider owns the slug + streamer cache
 * so every mounted tip-ui component sees the same state. `bootstrap()` is
 * idempotent — safe to call on every twitch-token change.
 */
export interface UseStreamerResult {
  slug: string | null;
  streamer: StreamerPublic | null;
  status: ConnectStatus;
  /** Upsert the streamer row using the current Twitch token. No-op if no token. */
  bootstrap: () => Promise<void>;
  /** Returns a short-lived Stripe Account Link URL to hand to window.open. */
  connectStripeUrl: () => Promise<string>;
  /** Refresh cached Connect status from Stripe (via the Edge Function). */
  refresh: () => Promise<void>;
}

export interface TipsProviderProps {
  children: ReactNode;
  /** Supabase project URL + anon key. The provider does no network calls until a Twitch token arrives. */
  config: SupabaseFunctionsConfig;
  /** The currently-connected Twitch access token. `null` means "not logged in". */
  twitchAccessToken: string | null;
}

const TipsContext = createContext<UseStreamerResult | null>(null);

/**
 * TipsProvider plumbs the ensure-streamer → get-connect-status → connect-link
 * flow without showing any UI. Mount alongside the TwitchProvider. Task 23
 * hangs the payout dialog and tip-page onto this context.
 *
 * Bootstrap runs automatically every time `twitchAccessToken` flips to a
 * new non-null value. The streamer row survives a token refresh because
 * the server keys on `twitch_user_id`, not the token.
 */
export function TipsProvider({ children, config, twitchAccessToken }: TipsProviderProps) {
  const [streamer, setStreamer] = useState<StreamerPublic | null>(null);
  const [status, setStatus] = useState<ConnectStatus>({ status: "not_connected" });
  const tokenRef = useRef<string | null>(twitchAccessToken);
  tokenRef.current = twitchAccessToken;

  const bootstrap = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    const out = await callEnsureStreamer(config, { twitchAccessToken: token });
    setStreamer(out.streamer);
  }, [config]);

  const refresh = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    const out = await callGetConnectStatus(config, { twitchAccessToken: token });
    setStatus(out);
  }, [config]);

  const connectStripeUrl = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) throw new Error("connectStripeUrl: no Twitch token");
    const out = await callCreateConnectLink(config, { twitchAccessToken: token });
    return out.url;
  }, [config]);

  // Auto-bootstrap on token change. We keep a local "run id" so a fast
  // token flip cancels the previous inflight call before it writes state.
  useEffect(() => {
    if (!twitchAccessToken) {
      setStreamer(null);
      setStatus({ status: "not_connected" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await bootstrap();
        if (cancelled) return;
        await refresh();
      } catch (err) {
        if (cancelled) return;
        console.warn("[supabase-client] TipsProvider bootstrap failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [twitchAccessToken, bootstrap, refresh]);

  const value = useMemo<UseStreamerResult>(
    () => ({
      slug: streamer?.slug ?? null,
      streamer,
      status,
      bootstrap,
      connectStripeUrl,
      refresh,
    }),
    [streamer, status, bootstrap, connectStripeUrl, refresh],
  );

  return <TipsContext.Provider value={value}>{children}</TipsContext.Provider>;
}

/** Hook: read the current streamer/connection state. Throws outside the provider. */
export function useStreamer(): UseStreamerResult {
  const ctx = useContext(TipsContext);
  if (!ctx) throw new Error("useStreamer must be used inside <TipsProvider>");
  return ctx;
}
