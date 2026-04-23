/// <reference lib="deno.ns" />
/**
 * Verifies a Twitch OAuth access token by hitting
 * `https://id.twitch.tv/oauth2/validate`. Returns the identity fields we
 * need to resolve the caller to a `streamers` row.
 *
 * This is the server-side equivalent of `@obs/twitch/validateToken`.
 * Duplicated rather than shared because Edge Functions run in Deno with
 * URL imports only.
 */

export interface TwitchIdentity {
  userId: string;
  login: string;
  scopes: string[];
  clientId: string;
}

const VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";

export async function validateTwitchToken(token: string): Promise<TwitchIdentity> {
  if (!token) throw new Error("validateTwitchToken: missing token");
  const res = await fetch(VALIDATE_URL, {
    method: "GET",
    headers: { Authorization: `OAuth ${token}` },
  });
  if (res.status === 401) {
    throw new HttpError(401, "Twitch token invalid or expired.");
  }
  if (!res.ok) {
    throw new HttpError(502, `Twitch validate failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  if (
    typeof body.client_id !== "string" ||
    typeof body.login !== "string" ||
    typeof body.user_id !== "string"
  ) {
    throw new HttpError(502, "Twitch validate returned an unexpected payload.");
  }
  return {
    userId: body.user_id,
    login: body.login,
    scopes: Array.isArray(body.scopes) ? body.scopes : [],
    clientId: body.client_id,
  };
}

/** Tiny typed error so handlers can map to the right HTTP status. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}
