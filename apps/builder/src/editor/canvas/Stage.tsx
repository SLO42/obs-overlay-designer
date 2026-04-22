import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, Ref } from "react";
import type { CanvasSize } from "@obs/core";
import styles from "./Canvas.module.css";

interface StageProps {
  canvas: CanvasSize;
  stageRef: Ref<HTMLDivElement>;
  children: ReactNode;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/**
 * The 1920×1080 art-board frame. Sized in authoring pixels — the parent
 * applies a `scale(...)` transform to fit the viewport. Applies the
 * dotted background motif from the design system.
 */
export function Stage({ canvas, stageRef, children, onPointerDown }: StageProps) {
  const style: CSSProperties = {
    width: canvas.width,
    height: canvas.height,
  };
  return (
    <div ref={stageRef} className={styles.stage} style={style} onPointerDown={onPointerDown}>
      {children}
    </div>
  );
}
