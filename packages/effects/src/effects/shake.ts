import type { Cleanup } from "../types";
import { effects } from "../registry";
import { prefersReducedMotion } from "../utils/prefersReducedMotion";
// Ensure `target.animate(...)` exists under happy-dom. No-op in real browsers.
import "../utils/webAnimationsShim";

/**
 * Build an 8-point keyframe ramp that alternates +amp / -amp / +amp / ...
 * on the X axis, easing out. Starts + ends at 0 so the element lands back
 * in place even if something cancels mid-flight.
 */
function buildKeyframes(amplitude: number): Keyframe[] {
  const a = amplitude;
  const frames: Array<{ offset: number; x: number }> = [
    { offset: 0, x: 0 },
    { offset: 0.14, x: +a },
    { offset: 0.28, x: -a },
    { offset: 0.42, x: +a * 0.75 },
    { offset: 0.56, x: -a * 0.75 },
    { offset: 0.7, x: +a * 0.5 },
    { offset: 0.85, x: -a * 0.25 },
    { offset: 1, x: 0 },
  ];
  return frames.map((f) => ({
    offset: f.offset,
    transform: `translate(${f.x}px, 0)`,
  }));
}

/**
 * Shake the target horizontally. Uses WAAPI so cleanup is
 * `animation.cancel()` and we don't fight React re-renders by mutating the
 * target's inline style. Reduced-motion path is a single soft 1px pulse —
 * acknowledges the trigger without being distracting.
 */
effects.register("shake", (target, effect, ctx): Cleanup => {
  if (ctx?.respectReducedMotion && prefersReducedMotion()) {
    const pulse = (target as HTMLElement).animate(
      [
        { offset: 0, transform: "translate(0,0)" },
        { offset: 0.5, transform: "translate(1px,0)" },
        { offset: 1, transform: "translate(0,0)" },
      ],
      { duration: 180, easing: "ease-out", fill: "none" },
    );
    let done = false;
    return () => {
      if (done) return;
      done = true;
      try {
        pulse.cancel();
      } catch {
        /* ignore */
      }
    };
  }

  const amplitude = Math.max(0, effect.amplitude);
  const duration = Math.max(1, effect.durationMs);
  const animation = (target as HTMLElement).animate(buildKeyframes(amplitude), {
    duration,
    easing: "ease-out",
    fill: "none",
  });

  let done = false;
  return () => {
    if (done) return;
    done = true;
    try {
      animation.cancel();
    } catch {
      /* ignore */
    }
  };
});
