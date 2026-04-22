/**
 * Lazy access to the Twitch app client id. We read it on first use (not at
 * import time) so tests in sibling packages aren't forced to stub
 * `import.meta.env` just to exercise unrelated modules that pull in a
 * `@obs/twitch` barrel import transitively.
 *
 * Resolution order:
 *   1. Explicit argument (caller-supplied, wins every time).
 *   2. `import.meta.env.VITE_TWITCH_CLIENT_ID` (Vite-powered apps).
 *   3. `process.env.VITE_TWITCH_CLIENT_ID` (Node/tests).
 */
function readFromEnv(): string | undefined {
  // import.meta.env isn't always available (Node without Vite resolving it).
  // Wrap the access in a try/catch so we fail soft in that environment.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viteEnv = (import.meta as any).env as Record<string, string | undefined> | undefined;
    if (viteEnv && typeof viteEnv.VITE_TWITCH_CLIENT_ID === "string") {
      return viteEnv.VITE_TWITCH_CLIENT_ID;
    }
  } catch {
    // ignore — fallthrough to process.env
  }
  const g = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  const envVal = g.process?.env?.VITE_TWITCH_CLIENT_ID;
  if (typeof envVal === "string" && envVal.length > 0) {
    return envVal;
  }
  return undefined;
}

/**
 * Returns the Twitch client id. Throws a descriptive error on first use if
 * the caller didn't supply one and the env var is missing. This matches the
 * task's rule: errors happen when you *use* the package, not when you
 * import it.
 */
export function getClientId(explicit?: string): string {
  if (explicit && explicit.length > 0) return explicit;
  const fromEnv = readFromEnv();
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  throw new Error(
    "Missing Twitch client id. Set VITE_TWITCH_CLIENT_ID in your environment or pass it explicitly to TwitchConnection/openAuthPopup.",
  );
}

/**
 * Returns the default redirect URI used by the popup flow. Safe to call on
 * the server — returns the empty string when no `window` is available, and
 * callers that rely on the default URI are always in a browser context.
 */
export function getDefaultRedirectUri(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/twitch/callback`;
}

/** Twitch OAuth2 authorize endpoint. Constant, exported for tests. */
export const AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";
/** Twitch OAuth2 validate endpoint. */
export const VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";
/** Twitch Helix base URL. */
export const HELIX_BASE_URL = "https://api.twitch.tv/helix";
/** Twitch EventSub WebSocket URL. */
export const EVENTSUB_WS_URL = "wss://eventsub.wss.twitch.tv/ws";
