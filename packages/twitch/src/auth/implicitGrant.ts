import { AUTHORIZE_URL, getClientId, getDefaultRedirectUri } from "../config";
import { DEFAULT_SCOPES, type Scope } from "./scopes";

/** localStorage key for the persisted token envelope. */
const STORAGE_KEY = "obs.twitch.token";

/** postMessage discriminator for the popup → opener hand-off. */
export const POPUP_MESSAGE_TYPE = "twitch/token";

/**
 * Envelope persisted to localStorage. `expiresAt` is a unix-epoch ms
 * timestamp so we can check expiry without depending on when the token was
 * issued. `userId` / `login` are populated after a `validateToken()` round
 * trip; they're optional because storeToken() may be called with the raw
 * popup payload before validation.
 */
export interface StoredToken {
  token: string;
  scopes: Scope[];
  expiresAt: number;
  userId?: string;
  login?: string;
}

/** Shape returned by the popup + exported for external consumers. */
export interface PopupResult {
  token: string;
  scopes: Scope[];
  expiresIn: number;
  state: string;
}

/** Shape returned by `consumeRedirect()` when a fragment is present. */
export interface RedirectResult {
  token: string;
  scopes: Scope[];
  state: string;
  expiresIn: number;
}

interface OpenAuthPopupOptions {
  /** Explicit client id — falls back to `VITE_TWITCH_CLIENT_ID`. */
  clientId?: string;
  /** Where Twitch redirects back to. Defaults to `${origin}/twitch/callback`. */
  redirectUri?: string;
  /** Requested OAuth scopes. Defaults to `DEFAULT_SCOPES`. */
  scopes?: Scope[];
  /** Override the random state (useful in tests). */
  state?: string;
  /** Optional signal to abort the popup wait. */
  signal?: AbortSignal;
}

/**
 * Generates a 16-char URL-safe random nonce. Falls back to Math.random in
 * environments without crypto (tests in pure Node without webcrypto — we
 * still use the same format so the shape of the authorize URL is stable).
 */
function randomState(len = 16): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(len);
  const g = globalThis as {
    crypto?: { getRandomValues?: (buf: Uint8Array) => Uint8Array };
  };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

/**
 * Builds the Twitch authorize URL for the implicit grant flow. Exported
 * for tests; `openAuthPopup` uses it internally.
 */
export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  scopes: Scope[];
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "token",
    scope: opts.scopes.join(" "),
    state: opts.state,
    force_verify: "false",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Parse the redirect fragment (`#access_token=…&scope=…&state=…`). Twitch
 * space-separates scopes. Returns null if the fragment lacks a token.
 */
export function parseRedirectFragment(fragment: string): RedirectResult | null {
  // Strip a leading '#' if present.
  const raw = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const token = params.get("access_token");
  if (!token) return null;
  const scopeRaw = params.get("scope") ?? "";
  const scopes = scopeRaw.length > 0 ? (scopeRaw.split(" ") as Scope[]) : [];
  const state = params.get("state") ?? "";
  const expiresIn = Number(params.get("expires_in") ?? "0");
  return { token, scopes, state, expiresIn: Number.isFinite(expiresIn) ? expiresIn : 0 };
}

/**
 * Opens a popup window pointed at Twitch's implicit-grant authorize URL
 * and resolves with the captured token. Expects the popup (served from our
 * own origin at `redirectUri`) to call `consumeRedirect()`, which
 * postMessages the token envelope back to `window.opener`.
 *
 * Rejects if:
 *  - the popup was blocked (`window.open` returned null)
 *  - the popup closed before a token arrived
 *  - the state nonce in the reply doesn't match what we sent
 *  - the caller's `AbortSignal` fires
 */
export function openAuthPopup(options: OpenAuthPopupOptions = {}): Promise<PopupResult> {
  const clientId = getClientId(options.clientId);
  const redirectUri = options.redirectUri ?? getDefaultRedirectUri();
  const scopes = options.scopes ?? DEFAULT_SCOPES;
  const state = options.state ?? randomState();

  const url = buildAuthorizeUrl({ clientId, redirectUri, scopes, state });

  return new Promise<PopupResult>((resolve, reject) => {
    const features = "popup=yes,width=500,height=700";
    const popup = window.open(url, "obs-twitch-auth", features);
    if (!popup) {
      reject(new Error("Twitch auth popup was blocked by the browser."));
      return;
    }

    let settled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (pollId !== null) clearInterval(pollId);
      if (options.signal) options.signal.removeEventListener("abort", onAbort);
    };

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const onMessage = (event: MessageEvent) => {
      // Only accept same-origin messages. The popup is always served from
      // our origin (via the redirect URI), so Twitch's own origin is never
      // the sender of our expected payload.
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string } | null;
      if (!data || data.type !== POPUP_MESSAGE_TYPE) return;
      const payload = data as unknown as RedirectResult & { type: string };
      if (payload.state !== state) {
        settle(() => reject(new Error("Twitch auth state mismatch — possible CSRF.")));
        return;
      }
      settle(() =>
        resolve({
          token: payload.token,
          scopes: payload.scopes,
          expiresIn: payload.expiresIn,
          state: payload.state,
        }),
      );
      // Make sure the popup closes even if the callback page forgot to.
      try {
        popup.close();
      } catch {
        // ignore
      }
    };

    const onAbort = () => {
      try {
        popup.close();
      } catch {
        // ignore
      }
      settle(() => reject(new Error("Twitch auth popup aborted.")));
    };

    window.addEventListener("message", onMessage);
    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener("abort", onAbort);
    }

    // Poll the popup so we detect user-closed-without-auth. `closed` is
    // the only reliable signal we have across browsers.
    pollId = setInterval(() => {
      if (popup.closed) {
        settle(() => reject(new Error("Twitch auth popup was closed before completing.")));
      }
    }, 500);
  });
}

/**
 * Called by the redirect-target page ("/twitch/callback"). Parses the
 * current URL hash, forwards the payload to the opener via postMessage,
 * and closes the window. Returns the parsed envelope so callers that
 * load the page standalone (e.g. for debugging) can still see what came
 * back.
 *
 * Safe to call in non-browser contexts (returns null).
 */
export function consumeRedirect(): RedirectResult | null {
  if (typeof window === "undefined") return null;
  const parsed = parseRedirectFragment(window.location.hash);
  if (!parsed) return null;

  const opener = window.opener as Window | null;
  if (opener && !opener.closed) {
    try {
      // opener is same-origin (the builder). Use the opener's own origin
      // so strict-origin-check deployments still receive the message.
      // `opener.origin` throws cross-origin — guard with a fallback to our
      // own origin, which is the expected value anyway.
      let targetOrigin: string;
      try {
        targetOrigin = opener.location.origin;
      } catch {
        targetOrigin = window.location.origin;
      }
      opener.postMessage({ type: POPUP_MESSAGE_TYPE, ...parsed }, targetOrigin);
    } catch (err) {
      console.error("[twitch] failed to postMessage token back to opener", err);
    }
  }

  // Clear the hash so a refresh doesn't replay the token. Then close.
  try {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch {
    // ignore
  }
  try {
    window.close();
  } catch {
    // ignore
  }

  return parsed;
}

/** Persist the token envelope to localStorage. Skips expired envelopes. */
export function storeToken(entry: StoredToken): void {
  if (typeof localStorage === "undefined") return;
  if (entry.expiresAt <= Date.now()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch (err) {
    console.warn("[twitch] failed to persist token", err);
  }
}

/**
 * Returns the stored token envelope, or null if none / malformed / expired.
 * Expired envelopes are evicted as a side effect.
 */
export function loadStoredToken(): StoredToken | null {
  if (typeof localStorage === "undefined") return null;
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: StoredToken | null;
  try {
    parsed = JSON.parse(raw) as StoredToken;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed.token !== "string" || typeof parsed.expiresAt !== "number") {
    return null;
  }
  if (parsed.expiresAt <= Date.now()) {
    clearStoredToken();
    return null;
  }
  return parsed;
}

/** Remove the persisted token envelope. Idempotent. */
export function clearStoredToken(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
