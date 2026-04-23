/**
 * Reads Supabase public env vars on demand. We deliberately throw at USE
 * time rather than module-load time so the builder can ship without them
 * set (the tips plumbing simply doesn't light up). Apps that mount a
 * component depending on Supabase will surface the missing-env error at
 * that component's boundary rather than on import.
 */

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

/**
 * Best-effort read of `import.meta.env.VITE_SUPABASE_*`. Returns `null` if
 * either value is missing — callers decide whether that's fatal.
 */
export function readSupabasePublicConfig(): SupabasePublicConfig | null {
  // Guard against environments (node, vitest-without-vite) where
  // `import.meta.env` is undefined.
  const env =
    (typeof import.meta !== "undefined" &&
      (import.meta as { env?: Record<string, string | undefined> }).env) ||
    {};
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Same as `readSupabasePublicConfig` but throws if either env var is
 * missing. Use this inside code paths where the absence of Supabase config
 * is a programmer error (e.g. a component explicitly mounted for the
 * tips feature).
 */
export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const cfg = readSupabasePublicConfig();
  if (!cfg) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
        "Add them to your .env before enabling Supabase-backed features.",
    );
  }
  return cfg;
}
