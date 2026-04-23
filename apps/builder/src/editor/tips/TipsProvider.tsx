import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { readSupabasePublicConfig, type SupabaseFunctionsConfig } from "@obs/supabase-client";
import { TipsProvider as SupabaseTipsProvider, useStreamer } from "@obs/supabase-client/react";
import { useTwitchContext } from "../twitch/TwitchProvider";
import { useEditorStore } from "../../store/useEditorStore";

/**
 * Builder-side bootstrap error channel. `TipsProvider` (the Supabase one)
 * auto-calls `ensure-streamer` whenever a Twitch token arrives, but it
 * only `console.warn`s on failure. The Payouts dialog needs to surface
 * those failures to the user so a server-side outage isn't invisible.
 */
interface BootstrapErrorContext {
  error: Error | null;
}

const BootstrapErrorCtx = createContext<BootstrapErrorContext>({ error: null });

/** Hook for the Payouts dialog: reads the most recent bootstrap error, if any. */
export function useBootstrapError(): Error | null {
  return useContext(BootstrapErrorCtx).error;
}

/**
 * Builder-side glue around `@obs/supabase-client`'s TipsProvider. We bridge
 * two things:
 *   1. Twitch auth lives in `TwitchConnection` (via `TwitchProvider`). We
 *      subscribe to its status and feed the access token into the Supabase
 *      TipsProvider so it can call `ensure-streamer`.
 *   2. Once `useStreamer()` reports a slug, we stash it onto the editor
 *      store so the exported overlay carries `project.streamteam.slug`.
 *
 * If no Supabase env is configured, this provider is a no-op wrapper —
 * children mount normally and `useStreamer()` hooks will throw if used
 * (the UI consuming them is Task 23).
 */
export function TipsProvider({ children }: { children: ReactNode }) {
  const config = useMemo<SupabaseFunctionsConfig | null>(() => {
    const cfg = readSupabasePublicConfig();
    if (!cfg) return null;
    return { supabaseUrl: cfg.url, anonKey: cfg.anonKey };
  }, []);

  if (!config) {
    // Supabase env is missing — ship the children as-is. Any call to
    // `useStreamer()` in this tree will throw, which is the right signal
    // for the dev (you forgot to set VITE_SUPABASE_URL).
    return <>{children}</>;
  }

  return <SupabaseEnabledTipsProvider config={config}>{children}</SupabaseEnabledTipsProvider>;
}

/** Split so the hooks below only run when Supabase env is present. */
function SupabaseEnabledTipsProvider({
  children,
  config,
}: {
  children: ReactNode;
  config: SupabaseFunctionsConfig;
}) {
  const { connection } = useTwitchContext();
  const [token, setToken] = useState<string | null>(connection.token);
  const [bootstrapError, setBootstrapError] = useState<Error | null>(null);

  // Follow the Twitch connection's status; when we have a validated access
  // token, forward it into the Supabase TipsProvider so it can bootstrap.
  useEffect(() => {
    const read = () => setToken(connection.token);
    read();
    const off = connection.onStatusChange(() => read());
    return () => off();
  }, [connection]);

  // Reset the stored bootstrap error when the user reconnects Twitch — a
  // fresh token is our signal that the failing state might have healed.
  useEffect(() => {
    if (token) setBootstrapError(null);
  }, [token]);

  return (
    <BootstrapErrorCtx.Provider value={{ error: bootstrapError }}>
      <SupabaseTipsProvider config={config} twitchAccessToken={token}>
        <BootstrapSync onError={setBootstrapError} />
        <SlugSync />
        {children}
      </SupabaseTipsProvider>
    </BootstrapErrorCtx.Provider>
  );
}

/**
 * Side-effect-only component that runs `ensure-streamer` exactly once per
 * Twitch session the first time a successful connection is observed and
 * the slug isn't already in the cache.
 *
 * The outer `TipsProvider` (in @obs/supabase-client) auto-bootstraps on
 * token change too, but we re-call `bootstrap()` from the builder side for
 * one specific reason: we capture and surface errors locally so the
 * Payouts dialog can show them. The ref guard keeps this idempotent —
 * a second connect+disconnect cycle within the same session won't retrigger.
 */
function BootstrapSync({ onError }: { onError: (err: Error | null) => void }) {
  const { slug, bootstrap } = useStreamer();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    if (slug) {
      ran.current = true;
      return;
    }
    ran.current = true;
    void bootstrap()
      .then(() => onError(null))
      .catch((err: unknown) => {
        onError(err instanceof Error ? err : new Error(String(err)));
        // Re-allow a retry on the next mount cycle — failures shouldn't
        // silently wedge the editor forever.
        ran.current = false;
      });
  }, [slug, bootstrap, onError]);
  return null;
}

/**
 * Side-effect-only component: reads the current slug from `useStreamer`
 * and mirrors it onto the editor store whenever it changes. Rendered
 * nothing. Split out so the store write happens inside the Supabase
 * provider context (where `useStreamer` is safe to call).
 */
function SlugSync() {
  const { slug } = useStreamer();
  const currentSlug = useEditorStore((s) => s.project.streamteam?.slug ?? null);
  const setStreamteamSlug = useEditorStore((s) => s.setStreamteamSlug);
  useEffect(() => {
    if (!slug) return;
    if (slug === currentSlug) return;
    setStreamteamSlug(slug);
  }, [slug, currentSlug, setStreamteamSlug]);
  return null;
}
