/// <reference lib="deno.ns" />
import Stripe from "https://esm.sh/stripe@17?target=deno";

/**
 * Shared Stripe client factory. We pin the API version explicitly so
 * changes to the default version don't silently alter response shapes.
 * Bump the string when we intend to adopt a newer API version.
 */
const STRIPE_API_VERSION = "2024-11-20.acacia";

export function createStripeClient(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set on the function's env.");
  }
  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    // Deno uses fetch under the hood. Stripe's Deno target picks this up
    // automatically — we pass the flag so older versions of the lib don't
    // fall back to the (unavailable) node http client.
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export { Stripe };
export const StripeApiVersion = STRIPE_API_VERSION;
