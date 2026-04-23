/// <reference lib="deno.ns" />
import { corsFor, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { createStripeClient } from "../_shared/stripe.ts";
import { HttpError, validateTwitchToken } from "../_shared/twitchValidate.ts";

/**
 * POST /create-connect-link
 * body: { twitchAccessToken: string }
 *
 * Returns a Stripe Account Link URL for the streamer to finish onboarding.
 *
 * - If the streamer already has `stripe_account_id`, we just issue a fresh
 *   link for that account.
 * - Otherwise we create a Connect Express account, persist the id, and
 *   issue a link.
 *
 * The link is short-lived (Stripe expires Account Links in minutes) so
 * this endpoint is safe to call on every "Open Payouts" button click.
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

  const appUrl = Deno.env.get("APP_URL");
  if (!appUrl) {
    return jsonResponse(req, { error: "APP_URL not configured" }, { status: 500 });
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

    const stripe = createStripeClient();

    let accountId = streamer.stripe_account_id as string | null;
    let created = false;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        metadata: { streamer_id: streamer.id },
      });
      accountId = account.id;
      created = true;
      const { error: updErr } = await admin
        .from("streamers")
        .update({ stripe_account_id: accountId })
        .eq("id", streamer.id);
      if (updErr) throw updErr;
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${appUrl}/payouts?status=refresh`,
      return_url: `${appUrl}/payouts?status=return`,
    });

    return jsonResponse(req, {
      url: link.url,
      ...(created ? { accountId } : {}),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(req, { error: err.message }, { status: err.status });
    }
    console.error("[create-connect-link]", err);
    return jsonResponse(req, { error: "internal error" }, { status: 500 });
  }
});
