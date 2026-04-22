import type { CSSProperties } from "react";
import type { Transform } from "@obs/core";

/**
 * Builds the inline style object that positions + rotates a widget inside
 * the stage. Coordinates are in stage (canvas) pixels; the parent stage
 * applies a single CSS scale to fit the viewport so every widget's style
 * works directly against its authored transform.
 *
 * `anchor` defaults to (0.5, 0.5) — rotation pivots around the center of
 * the widget's own box by default.
 */
export function transformStyle(t: Transform, zIndex?: number): CSSProperties {
  const ax = t.anchor?.x ?? 0.5;
  const ay = t.anchor?.y ?? 0.5;
  return {
    position: "absolute",
    left: t.x,
    top: t.y,
    width: t.w,
    height: t.h,
    transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined,
    transformOrigin: `${ax * 100}% ${ay * 100}%`,
    zIndex: zIndex ?? t.zIndex,
  };
}
