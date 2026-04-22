import { VALIDATE_URL } from "../config";

/**
 * Minimal view of Twitch's /oauth2/validate response. We only pick the
 * fields the overlay needs; extra response fields are ignored.
 */
export interface TokenInfo {
  valid: true;
  clientId: string;
  login: string;
  userId: string;
  expiresIn: number;
  scopes: string[];
}

export type ValidateResult = TokenInfo | { valid: false };

interface ValidateOptions {
  /** Abort signal; cancels the in-flight fetch. */
  signal?: AbortSignal;
  /** Override for tests (defaults to global fetch). */
  fetchImpl?: typeof fetch;
}

/**
 * GET `https://id.twitch.tv/oauth2/validate` with `Authorization: OAuth <token>`.
 * Returns `{valid: false}` on 401 (invalid / expired token) and throws on
 * unexpected network / 5xx errors. Any 2xx with the expected payload is
 * treated as `valid: true`.
 */
export async function validateToken(
  token: string,
  opts: ValidateOptions = {},
): Promise<ValidateResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const response = await fetchImpl(VALIDATE_URL, {
    method: "GET",
    headers: { Authorization: `OAuth ${token}` },
    signal: opts.signal,
  });

  if (response.status === 401) {
    return { valid: false };
  }
  if (!response.ok) {
    throw new Error(`Twitch validate failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as {
    client_id?: string;
    login?: string;
    user_id?: string;
    expires_in?: number;
    scopes?: string[];
  };

  if (
    typeof body.client_id !== "string" ||
    typeof body.login !== "string" ||
    typeof body.user_id !== "string"
  ) {
    throw new Error("Twitch validate returned an unexpected payload.");
  }

  return {
    valid: true,
    clientId: body.client_id,
    login: body.login,
    userId: body.user_id,
    expiresIn: typeof body.expires_in === "number" ? body.expires_in : 0,
    scopes: Array.isArray(body.scopes) ? body.scopes : [],
  };
}
