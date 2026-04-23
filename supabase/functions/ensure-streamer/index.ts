/// <reference lib="deno.ns" />
import { corsFor, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { HttpError, validateTwitchToken } from "../_shared/twitchValidate.ts";

/**
 * POST /ensure-streamer
 * body: { twitchAccessToken: string, slug?: string }
 *
 * Verifies the caller's Twitch token, UPSERTs a `streamers` row keyed on
 * `twitch_user_id`, and returns the public shape.
 *
 * Slug rules:
 *   - On INSERT: if `slug` is supplied we use it (validated + uniqueness
 *     checked); otherwise we generate one from the login + a 4-char random
 *     suffix if taken.
 *   - On UPDATE: we never change the slug unless the caller explicitly
 *     passed `slug`, AND the streamer has no `stripe_account_id` yet.
 *     Once Stripe is linked, the slug is frozen so tip-page URLs stay
 *     valid for viewers.
 */

interface Body {
  twitchAccessToken?: string;
  slug?: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "streamer";
}

function randomSuffix(len = 4): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

function isValidExplicitSlug(slug: string): boolean {
  // URL-safe, 3-40 chars, lower-kebab only.
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(slug);
}

async function pickAvailableSlug(
  admin: ReturnType<typeof createAdminClient>,
  base: string,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const { data, error } = await admin
      .from("streamers")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  // Very unlucky — fall back to a fully random slug.
  return `streamer-${randomSuffix(8)}`;
}

function toPublicStreamer(row: Record<string, unknown>) {
  return {
    id: row.id,
    twitchUserId: row.twitch_user_id,
    twitchLogin: row.twitch_login,
    displayName: row.display_name,
    slug: row.slug,
    stripeAccountId: row.stripe_account_id ?? null,
    stripeChargesEnabled: Boolean(row.stripe_charges_enabled),
    stripePayoutsEnabled: Boolean(row.stripe_payouts_enabled),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsFor(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method not allowed" }, { status: 405 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "invalid JSON body" }, { status: 400 });
  }

  const token = body.twitchAccessToken;
  if (!token) {
    return jsonResponse(req, { error: "twitchAccessToken is required" }, { status: 400 });
  }

  try {
    const identity = await validateTwitchToken(token);
    const admin = createAdminClient();

    // Load the existing row (if any) — we need it to decide slug policy.
    const { data: existing, error: selErr } = await admin
      .from("streamers")
      .select("*")
      .eq("twitch_user_id", identity.userId)
      .maybeSingle();
    if (selErr) throw selErr;

    const requestedSlug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    if (requestedSlug && !isValidExplicitSlug(requestedSlug)) {
      return jsonResponse(
        req,
        { error: "slug must be 2-40 chars, lowercase letters/numbers/hyphens" },
        { status: 400 },
      );
    }

    if (!existing) {
      // INSERT path. Pick a slug; prefer the explicit one if valid.
      let slug: string;
      if (requestedSlug) {
        const { data: dupe } = await admin
          .from("streamers")
          .select("id")
          .eq("slug", requestedSlug)
          .maybeSingle();
        if (dupe) {
          return jsonResponse(req, { error: "slug taken" }, { status: 409 });
        }
        slug = requestedSlug;
      } else {
        slug = await pickAvailableSlug(admin, slugify(identity.login));
      }

      const { data: inserted, error: insErr } = await admin
        .from("streamers")
        .insert({
          twitch_user_id: identity.userId,
          twitch_login: identity.login,
          display_name: identity.login,
          slug,
        })
        .select("*")
        .single();
      if (insErr) throw insErr;
      return jsonResponse(req, { streamer: toPublicStreamer(inserted) });
    }

    // UPDATE path. Refresh the login / display_name in case the user
    // renamed on Twitch. Only allow slug change when explicit + no Stripe
    // account linked.
    const patch: Record<string, unknown> = {
      twitch_login: identity.login,
      display_name: identity.login,
    };
    if (requestedSlug && requestedSlug !== existing.slug) {
      if (existing.stripe_account_id) {
        return jsonResponse(
          req,
          { error: "slug is frozen once Stripe is linked" },
          { status: 409 },
        );
      }
      const { data: dupe } = await admin
        .from("streamers")
        .select("id")
        .eq("slug", requestedSlug)
        .maybeSingle();
      if (dupe && dupe.id !== existing.id) {
        return jsonResponse(req, { error: "slug taken" }, { status: 409 });
      }
      patch.slug = requestedSlug;
    }

    const { data: updated, error: updErr } = await admin
      .from("streamers")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updErr) throw updErr;
    return jsonResponse(req, { streamer: toPublicStreamer(updated) });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(req, { error: err.message }, { status: err.status });
    }
    console.error("[ensure-streamer]", err);
    return jsonResponse(req, { error: "internal error" }, { status: 500 });
  }
});
