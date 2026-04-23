import { useEffect, useMemo, useState, type ReactNode } from "react";
import { readSupabasePublicConfig, type SupabaseFunctionsConfig } from "@obs/supabase-client";
import { TipsProvider as SupabaseTipsProvider, useStreamer } from "@obs/supabase-client/react";
import { useTwitchContext } from "../twitch/TwitchProvider";
import { useEditorStore } from "../../store/useEditorStore";

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

  // Follow the Twitch connection's status; when we have a validated access
  // token, forward it into the Supabase TipsProvider so it can bootstrap.
  useEffect(() => {
    const read = () => setToken(connection.token);
    read();
    const off = connection.onStatusChange(() => read());
    return () => off();
  }, [connection]);

  return (
    <SupabaseTipsProvider config={config} twitchAccessToken={token}>
      <SlugSync />
      {children}
    </SupabaseTipsProvider>
  );
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
