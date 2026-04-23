/// <reference lib="deno.ns" />
/**
 * CORS helper. The allowlist comes from the `ALLOWED_ORIGINS` env var (a
 * comma-separated list). In dev the builder runs at http://localhost:5173;
 * in prod it's whatever Vercel domain you set. We reject unknown origins
 * rather than echoing `*` because functions like `create-checkout-session`
 * carry tip amounts — CSRF surface that we don't want to give away.
 *
 * Usage:
 *   const cors = corsFor(req);
 *   if (req.method === "OPTIONS") return new Response(null, { headers: cors });
 *   return new Response(JSON.stringify(body), { headers: { ...cors, "content-type": "application/json" } });
 */

export function allowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = allowedOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, stripe-signature",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (allowed.length === 0) {
    // No allowlist configured → be permissive so local dev works before
    // the user sets ALLOWED_ORIGINS. Production deploys MUST set it.
    headers["Access-Control-Allow-Origin"] = origin || "*";
  }
  return headers;
}

/** Shortcut JSON responder with CORS applied. */
export function jsonResponse(
  req: Request,
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsFor(req),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}
