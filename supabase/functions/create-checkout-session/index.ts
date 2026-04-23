/// <reference lib="deno.ns" />
import { corsFor, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { createStripeClient } from "../_shared/stripe.ts";
import {
  computeCoveredFees,
  computeSharedFees,
  PLATFORM_FEE_CENTS,
} from "../_shared/fees.ts";

/**
 * POST /create-checkout-session  (public — no Twitch token)
 * body: {
 *   slug: string,
 *   netCents: number,            // desired streamer-net in minor units
 *   currency: "usd",
 *   coverFees: boolean,          // viewer pays Stripe + platform fee on top
 *   viewerDisplayName?: string,
 *   message?: string,
 * }
 *
 * Returns `{ url }` — the Stripe Checkout Session URL for the viewer.
 *
 * Validation rules:
 *   - netCents >= 100 (our $1 minimum)
 *   - currency === "usd"
 *   - viewerDisplayName length <= 40
 *   - message length <= 200
 *   - streamer must exist, have a stripe_account_id, and be charges-enabled.
 *
 * Metadata we stash on the PaymentIntent is what `stripe-webhook` reads
 * back out on `checkout.session.completed`. Everything we need to insert a
 * donation row (including fee amounts pre-computed by the fee solver) is
 * stored there so the webhook doesn't have to recompute.
 */

interface Body {
  slug?: string;
  netCents?: number;
  currency?: string;
  coverFees?: boolean;
  viewerDisplayName?: string;
  message?: string;
}

const MIN_NET_CENTS = 100;
const MAX_NAME_LEN = 40;
const MAX_MESSAGE_LEN = 200;

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

  const appUrl = Deno.env.get("APP_URL");
  if (!appUrl) {
    return jsonResponse(req, { error: "APP_URL not configured" }, { status: 500 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!slug) {
    return jsonResponse(req, { error: "slug is required" }, { status: 400 });
  }
  const currency = typeof body.currency === "string" ? body.currency.toLowerCase() : "";
  if (currency !== "usd") {
    return jsonResponse(req, { error: "currency must be 'usd' for v1" }, { status: 400 });
  }
  if (
    typeof body.netCents !== "number" ||
    !Number.isInteger(body.netCents) ||
    body.netCents < MIN_NET_CENTS
  ) {
    return jsonResponse(
      req,
      { error: `netCents must be an integer >= ${MIN_NET_CENTS}` },
      { status: 400 },
    );
  }
  if (typeof body.coverFees !== "boolean") {
    return jsonResponse(req, { error: "coverFees must be a boolean" }, { status: 400 });
  }
  const viewerDisplayName = (body.viewerDisplayName ?? "").toString().trim();
  if (viewerDisplayName.length > MAX_NAME_LEN) {
    return jsonResponse(
      req,
      { error: `viewerDisplayName must be <= ${MAX_NAME_LEN} chars` },
      { status: 400 },
    );
  }
  const message = (body.message ?? "").toString();
  if (message.length > MAX_MESSAGE_LEN) {
    return jsonResponse(
      req,
      { error: `message must be <= ${MAX_MESSAGE_LEN} chars` },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const { data: streamer, error } = await admin
      .from("streamers")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!streamer) {
      return jsonResponse(req, { error: "streamer not found" }, { status: 404 });
    }
    if (!streamer.stripe_account_id || !streamer.stripe_charges_enabled) {
      return jsonResponse(
        req,
        { error: "streamer is not ready to accept tips" },
        { status: 409 },
      );
    }

    // Fee math. When `coverFees` is on, the viewer pays the total; the
    // streamer nets exactly netCents. When off, the total IS netCents and
    // fees come out of the streamer's net — we still stash the computed
    // net for the webhook to persist.
    let unitAmount: number;
    let netCents: number;
    let stripeFeeCents: number;
    if (body.coverFees) {
      const result = computeCoveredFees(body.netCents);
      unitAmount = result.amountTotalCents;
      netCents = body.netCents;
      stripeFeeCents = result.stripeFeeCents;
    } else {
      const result = computeSharedFees(body.netCents);
      unitAmount = body.netCents;
      netCents = result.amountNetCents;
      stripeFeeCents = result.stripeFeeCents;
    }

    const stripe = createStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: { name: `Tip to @${streamer.twitch_login}` },
            unit_amount: unitAmount,
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: PLATFORM_FEE_CENTS,
        transfer_data: { destination: streamer.stripe_account_id },
        metadata: {
          streamer_id: streamer.id,
          slug: streamer.slug,
          viewer_display_name: viewerDisplayName,
          message,
          covered_fees: String(body.coverFees),
          net_cents: String(netCents),
          stripe_fee_cents: String(stripeFeeCents),
          platform_fee_cents: String(PLATFORM_FEE_CENTS),
        },
      },
      success_url: `${appUrl}/tip/${slug}?status=success`,
      cancel_url: `${appUrl}/tip/${slug}?status=cancelled`,
    });

    return jsonResponse(req, { url: session.url });
  } catch (err) {
    console.error("[create-checkout-session]", err);
    return jsonResponse(req, { error: "internal error" }, { status: 500 });
  }
});
