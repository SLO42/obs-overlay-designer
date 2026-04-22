import type { Cleanup } from "../types";
import { effects } from "../registry";
import { prefersReducedMotion } from "../utils/prefersReducedMotion";
import "../utils/webAnimationsShim";

/**
 * Zoom-punch: scale up fast (ease-out), then settle with a bezier that
 * slightly overshoots on the way back. durationMs covers the whole beat.
 * Transform-origin is pinned to `center center` for the effect's life so
 * the punch reads correctly regardless of the target's layout.
 *
 * Reduced motion: no-op. Scale jumps feel violent even when "small", so we
 * choose to drop the effect entirely rather than approximate it.
 */
effects.register("zoom-punch", (target, effect, ctx): Cleanup => {
  if (ctx?.respectReducedMotion && prefersReducedMotion()) {
    return () => {};
  }

  const el = target as HTMLElement;
  const prevInlineOrigin = el.style.transformOrigin;
  el.style.transformOrigin = "center center";

  const scale = Math.max(1, effect.scale);
  const duration = Math.max(1, effect.durationMs);

  // Two-step: punch-in at 25% (ease-out), then spring back with a
  // slight overshoot — cubic-bezier(.34, 1.56, .64, 1) is the canonical
  // "back.out" curve. WAAPI supports per-keyframe easing via the `easing`
  // property on individual frames.
  const animation = el.animate(
    [
      { offset: 0, transform: "scale(1)", easing: "ease-out" },
      { offset: 0.25, transform: `scale(${scale})`, easing: "cubic-bezier(.34,1.56,.64,1)" },
      { offset: 1, transform: "scale(1)" },
    ],
    { duration, easing: "ease-out", fill: "none" },
  );

  let done = false;
  const cleanup: Cleanup = () => {
    if (done) return;
    done = true;
    try {
      animation.cancel();
    } catch {
      /* ignore */
    }
    // Restore transform-origin. Preserve the exact original inline value —
    // `""` removes the property so inherited/stylesheet values take over.
    if (prevInlineOrigin) {
      el.style.transformOrigin = prevInlineOrigin;
    } else {
      el.style.removeProperty("transform-origin");
    }
  };

  animation.onfinish = () => cleanup();

  return cleanup;
});
