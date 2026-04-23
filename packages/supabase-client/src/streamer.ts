/**
 * Thin wrappers around the Supabase Edge Functions. They all POST JSON
 * against the functions endpoint. The Supabase REST URL is
 *   `<SUPABASE_URL>/functions/v1/<name>`
 *
 * Functions that require a Twitch token take it in the request body rather
 * than in an `Authorization` header — Supabase's functions runtime uses the
 * Authorization header for its own anon/user JWT. The Edge Function code
 * reads `twitchAccessToken` from the body and validates it against
 * id.twitch.tv.
 */

export interface ConnectStatus {
  status: "not_connected" | "pending" | "active";
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
}

export interface StreamerPublic {
  id: string;
  twitchUserId: string;
  twitchLogin: string;
  displayName: string;
  slug: string;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
}

export interface SupabaseFunctionsConfig {
  /** e.g. "https://abcdefghij.supabase.co" */
  supabaseUrl: string;
  /** The anon public key — required by Supabase to accept invocations. */
  anonKey: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
}

function functionsUrl(cfg: SupabaseFunctionsConfig, name: string): string {
  const base = cfg.supabaseUrl.replace(/\/+$/, "");
  return `${base}/functions/v1/${name}`;
}

async function postJson<T>(
  cfg: SupabaseFunctionsConfig,
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const res = await fetchImpl(functionsUrl(cfg, name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Supabase's functions gateway requires the anon key as a bearer or
      // apikey. We send both to match every doc example.
      Authorization: `Bearer ${cfg.anonKey}`,
      apikey: cfg.anonKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    throw new Error(
      `${name} failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`,
    );
  }
  return (await res.json()) as T;
}

/**
 * UPSERT a streamer row for the caller. Called after Twitch login. Slug is
 * generated server-side if not supplied; only renamable when no Stripe
 * account is linked.
 */
export function callEnsureStreamer(
  cfg: SupabaseFunctionsConfig,
  args: { twitchAccessToken: string; slug?: string },
): Promise<{ streamer: StreamerPublic }> {
  return postJson(cfg, "ensure-streamer", args);
}

/**
 * Get (or create) a Stripe Connect onboarding link for the caller. The
 * returned `url` is short-lived — generate fresh on demand.
 */
export function callCreateConnectLink(
  cfg: SupabaseFunctionsConfig,
  args: { twitchAccessToken: string },
): Promise<{ url: string; accountId?: string }> {
  return postJson(cfg, "create-connect-link", args);
}

/**
 * Look up the current Connect status. Returns `"not_connected"` when the
 * streamer has never opened the onboarding flow, `"pending"` while
 * verification is incomplete, and `"active"` when both charges + payouts
 * are enabled.
 */
export function callGetConnectStatus(
  cfg: SupabaseFunctionsConfig,
  args: { twitchAccessToken: string },
): Promise<ConnectStatus> {
  return postJson(cfg, "get-connect-status", args);
}

/**
 * Kick off a Stripe Checkout Session for a tip. Public — no Twitch token.
 * Returns `{ url }` which the caller should redirect the viewer to.
 */
export function callCreateCheckoutSession(
  cfg: SupabaseFunctionsConfig,
  args: {
    slug: string;
    netCents: number;
    currency: "usd";
    coverFees: boolean;
    viewerDisplayName?: string;
    message?: string;
  },
): Promise<{ url: string }> {
  return postJson(cfg, "create-checkout-session", args);
}
