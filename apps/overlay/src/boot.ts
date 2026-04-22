import type { Project, TwitchConfig } from "@obs/core";

/**
 * The overlay's full config object. `project` is the only piece the DOM
 * renderer needs today; `twitch` and `donationSources` are carried through
 * so Task 7 (export) and Task 8 (sources) can wire them without a config
 * schema rewrite.
 */
export interface OverlayConfig {
  project: Project;
  twitch?: TwitchConfig;
  donationSources?: unknown;
}

/** Element id the export bundler (Task 7) uses to embed the frozen config. */
const CONFIG_SCRIPT_ID = "overlay-config";
/** URL param the builder's live-preview iframe (Task 6) uses. */
const CFG_PARAM = "cfg";

/**
 * Base64url → JSON. Pads the input back up to a length%4===0 before calling
 * atob, then swaps `-`/`_` back to `+`/`/`. Returns null on any failure.
 */
export function decodeBase64UrlJson<T>(input: string): T | null {
  try {
    let normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4;
    if (pad === 2) normalized += "==";
    else if (pad === 3) normalized += "=";
    else if (pad === 1) return null; // invalid
    const binary = atob(normalized);
    // atob yields a "binary string"; decode UTF-8 by round-tripping via bytes.
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  } catch (err) {
    console.error("[overlay] failed to decode base64url JSON", err);
    return null;
  }
}

/**
 * JSON → base64url. Trims trailing `=` so the string is safe to paste in a
 * URL without percent-escaping. Kept exported for `preview.ts` + tests.
 */
export function encodeBase64UrlJson(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function readEmbeddedConfig(doc: Document): OverlayConfig | null {
  const el = doc.getElementById(CONFIG_SCRIPT_ID);
  if (!el) return null;
  const text = el.textContent ?? "";
  if (text.trim().length === 0) return null;
  try {
    return JSON.parse(text) as OverlayConfig;
  } catch (err) {
    console.error(`[overlay] failed to parse <script id="${CONFIG_SCRIPT_ID}">`, err);
    return null;
  }
}

function readUrlConfig(search: string): OverlayConfig | null {
  const params = new URLSearchParams(search);
  const raw = params.get(CFG_PARAM);
  if (!raw) return null;
  return decodeBase64UrlJson<OverlayConfig>(raw);
}

/**
 * Resolves the overlay config from one of two sources, in order:
 *   1. `<script id="overlay-config" type="application/json">…</script>`
 *      embedded at export time (Task 7).
 *   2. `?cfg=<base64url-json>` URL param (builder live-preview iframe).
 *
 * Never throws — parse failures log and return null so the runtime can
 * fall back to the empty state.
 */
export function resolveConfig(
  doc: Document = document,
  search: string = typeof window !== "undefined" ? window.location.search : "",
): OverlayConfig | null {
  return readEmbeddedConfig(doc) ?? readUrlConfig(search);
}
