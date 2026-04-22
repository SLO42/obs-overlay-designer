import type { Project } from "@obs/core";

/**
 * The element id the overlay's boot script looks for. Must stay in sync
 * with `CONFIG_SCRIPT_ID` in `apps/overlay/src/boot.ts`.
 */
const CONFIG_SCRIPT_ID = "overlay-config";

export interface ExportOptions {
  project: Project;
  /** Already-fetched overlay template HTML (see `template.ts`). */
  templateHtml: string;
}

/**
 * Pass-through used to be a stripper — the exported overlay is now
 * expected to carry the Twitch access token so the Browser Source can
 * auto-connect without user interaction (Task 10).
 *
 * The ExportDialog surfaces a warning when a token is present so the user
 * knows the file is effectively a bearer credential. Persistence
 * (IndexedDB) still drops the token via the store's serializer — that's
 * where the defensive strip belongs.
 */
function stripSecrets(project: Project): Project {
  return project;
}

// Unicode code points that must be escaped when embedding JSON in a
// <script> tag. Defined via \u escapes (never raw) so the source file
// stays ASCII: esbuild (and many editors) treat raw U+2028 / U+2029 as
// line terminators, which would prematurely end single-line comments.
const LS = "\u2028"; // LINE SEPARATOR
const PS = "\u2029"; // PARAGRAPH SEPARATOR

const LT_RE = /</g;
const LS_RE = new RegExp(LS, "g");
const PS_RE = new RegExp(PS, "g");

/**
 * Escape a JSON payload so it's safe to embed between
 * `<script type="application/json">...</script>` tags.
 *
 * The attack surface is purely the runtime HTML parser: a literal
 * `</script>` anywhere inside the JSON terminates the script element
 * early, and U+2028 / U+2029 are historically treated as line terminators
 * by some parsers. We escape `<` as `<` (which handles `</script>`
 * without needing a more specific replacement), and the line/paragraph
 * separators as their \u escapes. The result is still valid JSON
 * (so `JSON.parse` round-trips) and the original strings survive
 * unchanged.
 */
function escapeJsonForScript(json: string): string {
  return json.replace(LT_RE, "\\u003C").replace(LS_RE, "\\u2028").replace(PS_RE, "\\u2029");
}

/**
 * Remove any pre-existing `<script id="overlay-config">` block from the
 * template. Used when an exported overlay HTML is re-exported -- we don't
 * want to leave the old config sitting above the new one.
 *
 * The regex is deliberately anchored to our specific id; it won't touch
 * other inline JSON scripts.
 */
const EXISTING_CONFIG_RE =
  /[ \t]*<script\b[^>]*\bid=["']overlay-config["'][^>]*>[\s\S]*?<\/script>\s*\n?/i;

/**
 * Build the final single-file overlay HTML by injecting the current
 * project as JSON into the template.
 *
 * - The injected tag uses `type="application/json"` so the browser does
 *   NOT execute it; the overlay's boot code reads `.textContent` and
 *   JSON.parses it (`apps/overlay/src/boot.ts`).
 * - If the template already contains an `overlay-config` script (from a
 *   previous export round-trip), it is replaced rather than duplicated.
 * - Throws with a clear message if the template is missing `</head>`.
 */
export function buildOverlayHtml(opts: ExportOptions): string {
  const { project, templateHtml } = opts;

  // Drop the existing overlay-config script if present. Keeps the output
  // idempotent when users re-export a downloaded file.
  const cleaned = templateHtml.replace(EXISTING_CONFIG_RE, "");

  const headCloseIdx = cleaned.search(/<\/head\s*>/i);
  if (headCloseIdx === -1) {
    throw new Error(
      "buildOverlayHtml: template is missing a </head> tag; cannot inject overlay-config.",
    );
  }

  const sanitized = stripSecrets(project);
  const json = escapeJsonForScript(JSON.stringify(sanitized));
  const scriptTag = `    <script id="${CONFIG_SCRIPT_ID}" type="application/json">${json}</script>\n  `;

  return cleaned.slice(0, headCloseIdx) + scriptTag + cleaned.slice(headCloseIdx);
}

/**
 * Trigger a browser download of the given HTML string as a file. Uses the
 * standard Blob + anchor-click pattern; revokes the object URL on the
 * next tick to avoid holding the Blob in memory.
 *
 * In non-browser / test environments (no `document`), this is a no-op
 * rather than throwing -- callers should guard their own environments
 * when that matters.
 */
export function downloadOverlayHtml(html: string, filename: string): void {
  if (typeof document === "undefined") return;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  // Must be in the DOM for some browsers (Firefox historically) to honor
  // the click; hidden via style to keep it invisible in the UI.
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the blob URL once the browser has had a tick to start the
  // download. 0ms timeout is sufficient in practice.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Normalize a free-form project name into a filesystem-safe filename
 * stem. Replaces any run of characters outside `[a-z0-9\-_]` with a
 * single hyphen, trims leading/trailing hyphens, and falls back to
 * "streamteam" if the result is empty.
 */
export function safeFilename(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9\-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized.length === 0 ? "streamteam" : sanitized;
}
