/**
 * Returns true when the user has expressed a preference for reduced motion
 * via `prefers-reduced-motion: reduce`. Returns false when `matchMedia` is
 * unavailable (server, older browsers, most test envs) — the caller decides
 * whether to downgrade the effect.
 */
export function prefersReducedMotion(): boolean {
  if (typeof globalThis === "undefined") return false;
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  if (typeof mm !== "function") return false;
  try {
    return mm("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}
