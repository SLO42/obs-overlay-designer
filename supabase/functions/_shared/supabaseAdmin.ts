/// <reference lib="deno.ns" />
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

/**
 * Service-role client factory. The service role bypasses RLS, so this
 * client is used for every write the functions perform (UPSERTs on
 * streamers, INSERTs into donations, realtime `send`).
 *
 * Reads env at call time rather than module init so tests can monkey-patch
 * `Deno.env` between invocations.
 */
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the function's env.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-streamteam-fn": "admin" } },
  });
}
