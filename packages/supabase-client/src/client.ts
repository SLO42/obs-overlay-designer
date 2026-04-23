import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Thin factory around `createClient` with the options we actually want in
 * both the builder and the overlay:
 *   - `persistSession: false` — we do NOT use Supabase Auth, streamers
 *     authenticate via Twitch. Avoids a stray `sb-*-auth-token` in
 *     localStorage.
 *   - `autoRefreshToken: false` — same reason.
 *   - realtime defaults are fine; we only use broadcast channels.
 */
export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export type { SupabaseClient };
