/**
 * Overlay template fetching used by the builder's Export flow (Task 7).
 *
 * In dev, the Vite middleware in `apps/builder/vite.config.ts` serves the
 * contents of `apps/overlay/dist/index.html` at `/overlay-template.html`.
 * In production, `scripts/copy-overlay-template.mjs` places the same file
 * at the builder's static root.
 *
 * Either way, the fetch below is a same-origin GET. We cache the resolved
 * template in module scope so the Export dialog can reopen repeatedly
 * without refetching a ~1 MB blob; a hard refresh drops the cache.
 */

let cached: Promise<string> | null = null;

/**
 * Fetch the overlay template HTML. Throws a user-friendly error if the
 * response is missing, wrong content-type, or the dev middleware's
 * "overlay not built" placeholder. The error `.message` is suitable for
 * showing directly in the Export dialog.
 */
export async function fetchTemplate(base: string = "/overlay-template.html"): Promise<string> {
  if (cached) return cached;

  const promise = (async () => {
    let response: Response;
    try {
      response = await fetch(base, { cache: "no-cache" });
    } catch (err) {
      throw new Error(
        `Could not load the overlay template from ${base}. ` +
          `Check that the builder dev server is running. (${(err as Error).message})`,
      );
    }

    if (!response.ok) {
      // 503 is what the dev middleware sends when the overlay hasn't been
      // built yet; give the user a command to copy-paste.
      if (response.status === 503) {
        throw new Error(
          "Overlay template not found — run `pnpm --filter @obs/overlay build` first, then reload the builder.",
        );
      }
      throw new Error(
        `Overlay template request failed (HTTP ${response.status} ${response.statusText}).`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error(
        `Overlay template returned unexpected content-type "${contentType}" (expected text/html).`,
      );
    }

    return response.text();
  })();

  cached = promise;
  try {
    return await promise;
  } catch (err) {
    // Don't cache failures — user might fix the underlying problem and
    // retry without a page reload.
    cached = null;
    throw err;
  }
}

/**
 * Drop the cached template. Exposed for tests and for any future "reload
 * template" affordance.
 */
export function clearTemplateCache(): void {
  cached = null;
}
