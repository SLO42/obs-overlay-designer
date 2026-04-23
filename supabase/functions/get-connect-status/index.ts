/// <reference lib="deno.ns" />
import { corsFor, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { createStripeClient } from "../_shared/stripe.ts";
import { HttpError, validateTwitchToken } from "../_shared/twitchValidate.ts";

/**
 * POST /get-connect-status
 * body: { twitchAccessToken: string }
 *
 * Returns the caller's Stripe Connect status. Also refreshes the cached
 * `stripe_charges_enabled` / `stripe_payouts_enabled` flags on the
 * `streamers` row — we rely on those cached values in
 * `create-checkout-session` to gate tips without a round trip to Stripe.
 *
 * status values:
 *   "not_connected" — no Stripe account linked yet
 *   "pending"       — account exists but charges or payouts aren't ready
 *   "active"        — charges_enabled && payouts_enabled
 */

interface Body {
  twitchAccessToken?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsFor(req) });
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method not allowed" }, { status: 405 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.twitchAccessToken) {
    return jsonResponse(req, { error: "twitchAccessToken is required" }, { status: 400 });
  }

  try {
    const identity = await validateTwitchToken(body.twitchAccessToken);
    const admin = createAdminClient();

    const { data: streamer, error } = await admin
      .from("streamers")
      .select("*")
      .eq("twitch_user_id", identity.userId)
      .maybeSingle();
    if (error) throw error;
    if (!streamer) {
      return jsonResponse(
        req,
        { error: "streamer not found — call ensure-streamer first" },
        { status: 404 },
      );
    }

    if (!streamer.stripe_account_id) {
      return jsonResponse(req, { status: "not_connected" });
    }

    const stripe = createStripeClient();
    const account = await stripe.accounts.retrieve(streamer.stripe_account_id);

    const chargesEnabled = Boolean(account.charges_enabled);
    const payoutsEnabled = Boolean(account.payouts_enabled);
    const detailsSubmitted = Boolean(account.details_submitted);

    // Cache the flags on the row so the checkout function can gate tips
    // without an extra Stripe call.
    const { error: updErr } = await admin
      .from("streamers")
      .update({
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
      })
      .eq("id", streamer.id);
    if (updErr) throw updErr;

    const status = chargesEnabled && payoutsEnabled ? "active" : "pending";
    return jsonResponse(req, {
      status,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(req, { error: err.message }, { status: err.status });
    }
    console.error("[get-connect-status]", err);
    return jsonResponse(req, { error: "internal error" }, { status: 500 });
  }
});
