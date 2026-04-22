import type { Cleanup } from "../types";
import { effects } from "../registry";
import { prefersReducedMotion } from "../utils/prefersReducedMotion";
import "../utils/webAnimationsShim";

/**
 * Flash the target with a color wash. Appends an absolutely-positioned
 * `<div>` overlay as a child — this keeps the effect local to the target
 * without mutating its background and supports concurrent flashes (each
 * call owns its own overlay). If the target is `position: static` we bump
 * it to `relative` for the life of the effect + restore on cleanup.
 *
 * Reduced-motion path: single 120ms fade capped at 40% peak opacity.
 */
effects.register("flash", (target, effect, ctx): Cleanup => {
  const reduced = ctx?.respectReducedMotion === true && prefersReducedMotion();

  const doc = (target as HTMLElement).ownerDocument ?? globalThis.document;
  if (!doc || typeof doc.createElement !== "function") {
    // No document — nothing we can meaningfully do.
    return () => {};
  }

  // Preserve original inline position so we can restore it exactly.
  const prevInlinePosition = (target as HTMLElement).style.position;
  const computed =
    typeof getComputedStyle === "function" ? getComputedStyle(target as HTMLElement) : null;
  const needsRelative = !computed || computed.position === "static" || computed.position === "";
  if (needsRelative) {
    (target as HTMLElement).style.position = "relative";
  }

  const overlay = doc.createElement("div");
  overlay.setAttribute("data-effect", "flash");
  overlay.style.position = "absolute";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.backgroundColor = effect.color;
  overlay.style.opacity = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "9999";
  overlay.style.mixBlendMode = "screen";

  target.appendChild(overlay);

  const duration = Math.max(1, effect.durationMs);

  // 20% rise, 80% fall for the normal path. Reduced-motion uses a short
  // single-peak fade at 40%.
  const keyframes: Keyframe[] = reduced
    ? [
        { offset: 0, opacity: 0 },
        { offset: 0.5, opacity: 0.4 },
        { offset: 1, opacity: 0 },
      ]
    : [
        { offset: 0, opacity: 0 },
        { offset: 0.2, opacity: 0.75 },
        { offset: 1, opacity: 0 },
      ];

  const animation = overlay.animate(keyframes, {
    duration: reduced ? 120 : duration,
    easing: "ease-out",
    fill: "none",
  });

  let done = false;
  const cleanup: Cleanup = () => {
    if (done) return;
    done = true;
    try {
      animation.cancel();
    } catch {
      /* ignore */
    }
    if (overlay.parentNode === target) {
      target.removeChild(overlay);
    }
    // Restore inline position only if we changed it.
    if (needsRelative) {
      if (prevInlinePosition) {
        (target as HTMLElement).style.position = prevInlinePosition;
      } else {
        (target as HTMLElement).style.removeProperty("position");
      }
    }
  };

  // Auto-cleanup when the animation finishes on its own so callers don't
  // have to track every effect's completion. Triggers + CustomTrigger do
  // track cleanups so they can cancel mid-flight anyway.
  animation.onfinish = () => cleanup();

  return cleanup;
});
