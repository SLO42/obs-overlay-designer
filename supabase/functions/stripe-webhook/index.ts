/// <reference lib="deno.ns" />
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { createStripeClient, Stripe } from "../_shared/stripe.ts";

/**
 * POST /stripe-webhook  (public — no Twitch token)
 *
 * Reads the raw body + `stripe-signature` header, verifies against
 * `STRIPE_WEBHOOK_SECRET`, and handles:
 *
 *   checkout.session.completed  → insert donations row + broadcast on
 *                                 `tips:<slug>`.
 *   account.updated             → sync cached charges/payouts flags on
 *                                 the matching streamers row.
 *
 * Any other event is ACK'd with 200 so Stripe doesn't retry. Idempotency
 * rides on `donations.stripe_payment_intent_id` being UNIQUE — duplicate
 * webhook deliveries hit that constraint and we swallow the error.
 *
 * Note: we do NOT set CORS headers here. Stripe calls us server-to-server,
 * not from a browser.
 */

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("missing stripe-signature", { status: 400 });
  }
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    return new Response("STRIPE_WEBHOOK_SECRET not configured", { status: 500 });
  }

  const raw = await req.text();
  const stripe = createStripeClient();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return new Response("bad signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(stripe, event);
    } else if (event.type === "account.updated") {
      await handleAccountUpdated(event);
    }
    // Anything else: acknowledged but ignored.
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[stripe-webhook] handler threw", err);
    return new Response("internal error", { status: 500 });
  }
});

async function handleCheckoutCompleted(stripe: Stripe, event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  // We need the PaymentIntent + its metadata. `session.payment_intent` is
  // either a string id (when not expanded) or the expanded object.
  let paymentIntent: Stripe.PaymentIntent;
  if (typeof session.payment_intent === "string") {
    paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
  } else if (session.payment_intent && typeof session.payment_intent === "object") {
    paymentIntent = session.payment_intent;
  } else {
    console.warn("[stripe-webhook] session has no payment_intent", session.id);
    return;
  }

  const metadata = paymentIntent.metadata ?? {};
  const streamerId = metadata.streamer_id;
  if (!streamerId) {
    console.warn("[stripe-webhook] missing streamer_id metadata on", paymentIntent.id);
    return;
  }

  const amountPaid = typeof session.amount_total === "number" ? session.amount_total : paymentIntent.amount;
  const netCents = Number(metadata.net_cents ?? 0);
  const stripeFee = Number(metadata.stripe_fee_cents ?? 0);
  const platformFee = Number(metadata.platform_fee_cents ?? 1);
  const coveredFees = metadata.covered_fees === "true";
  const currency = (session.currency ?? paymentIntent.currency ?? "usd").toLowerCase();
  const slug = metadata.slug ?? "";

  const admin = createAdminClient();

  // Validate the streamer still exists (defensive — the FK will also catch
  // this, but a friendlier log helps diagnose "webhook before ensure" edge
  // cases).
  const { data: streamerRow, error: streamerErr } = await admin
    .from("streamers")
    .select("id, slug")
    .eq("id", streamerId)
    .maybeSingle();
  if (streamerErr) throw streamerErr;
  if (!streamerRow) {
    console.warn("[stripe-webhook] streamer row missing for id", streamerId);
    return;
  }

  const insert = {
    streamer_id: streamerId,
    stripe_payment_intent_id: paymentIntent.id,
    stripe_checkout_session_id: session.id,
    amount_net: netCents,
    amount_paid: amountPaid,
    stripe_fee: stripeFee,
    platform_fee: platformFee,
    currency,
    viewer_display_name: metadata.viewer_display_name || null,
    message: metadata.message || null,
    covered_fees: coveredFees,
  };

  const { data: inserted, error: insErr } = await admin
    .from("donations")
    .insert(insert)
    .select("id, created_at")
    .single();

  if (insErr) {
    // 23505 = unique_violation; this is the idempotency fast-path.
    const code = (insErr as { code?: string }).code;
    if (code === "23505") {
      console.info(
        "[stripe-webhook] duplicate delivery for pi",
        paymentIntent.id,
        "— ignoring",
      );
      return;
    }
    throw insErr;
  }

  // Broadcast on `tips:<slug>`. Supabase's realtime broadcast-from-server
  // path is just a channel.send — we join the channel, send, then drop.
  const channelName = `tips:${streamerRow.slug}`;
  const channel = admin.channel(channelName);
  await new Promise<void>((resolve) => {
    // The JS client requires a subscribe() before send() will succeed.
    const status = channel.subscribe((s) => {
      if (s === "SUBSCRIBED") resolve();
    });
    // Status callback is synchronous-ish; `subscribe()` itself returns the
    // channel. The `resolve` above is what actually unblocks us.
    void status;
  });
  try {
    await channel.send({
      type: "broadcast",
      event: "donation",
      payload: {
        id: inserted.id,
        source: "streamteam-tip",
        user: metadata.viewer_display_name
          ? { displayName: metadata.viewer_display_name, login: null }
          : null,
        amount: netCents,
        currency: currency.toUpperCase(),
        message: metadata.message || undefined,
        feeAmount: stripeFee + platformFee,
        coveredFees,
        receivedAt: Date.parse(inserted.created_at) || Date.now(),
      },
    });
  } finally {
    await admin.removeChannel(channel);
  }
}

async function handleAccountUpdated(event: Stripe.Event) {
  const account = event.data.object as Stripe.Account;
  const admin = createAdminClient();
  const { error } = await admin
    .from("streamers")
    .update({
      stripe_charges_enabled: Boolean(account.charges_enabled),
      stripe_payouts_enabled: Boolean(account.payouts_enabled),
    })
    .eq("stripe_account_id", account.id);
  if (error) throw error;
}
