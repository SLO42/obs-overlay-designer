import type { PointerEvent as ReactPointerEvent } from "react";
import type { Widget } from "@obs/core";
import type { ResizeHandle } from "./Canvas";
import styles from "./Canvas.module.css";

interface SelectionBoxProps {
  selection: string[];
  widgets: Widget[];
  onHandlePointerDown: (event: ReactPointerEvent<HTMLDivElement>, handle: ResizeHandle) => void;
}

const HANDLES: Array<{ key: ResizeHandle; left: string; top: string; cursor: string }> = [
  { key: "nw", left: "0%", top: "0%", cursor: "nwse-resize" },
  { key: "n", left: "50%", top: "0%", cursor: "ns-resize" },
  { key: "ne", left: "100%", top: "0%", cursor: "nesw-resize" },
  { key: "e", left: "100%", top: "50%", cursor: "ew-resize" },
  { key: "se", left: "100%", top: "100%", cursor: "nwse-resize" },
  { key: "s", left: "50%", top: "100%", cursor: "ns-resize" },
  { key: "sw", left: "0%", top: "100%", cursor: "nesw-resize" },
  { key: "w", left: "0%", top: "50%", cursor: "ew-resize" },
];

/**
 * Draws the violet selection rectangle + 8 resize handles around the
 * union bounding box of all selected widgets. Locked / hidden widgets
 * are still shown in the bounding box but their handles are styled the
 * same — the Canvas bails out of drag attempts on them separately.
 *
 * Handle coordinates are expressed as percentages of the selection rect
 * so they scale with the stage transform.
 */
export function SelectionBox({ selection, widgets, onHandlePointerDown }: SelectionBoxProps) {
  if (selection.length === 0) return null;
  const selected = widgets.filter((w) => selection.includes(w.id));
  if (selected.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const w of selected) {
    if (w.transform.x < minX) minX = w.transform.x;
    if (w.transform.y < minY) minY = w.transform.y;
    if (w.transform.x + w.transform.w > maxX) maxX = w.transform.x + w.transform.w;
    if (w.transform.y + w.transform.h > maxY) maxY = w.transform.y + w.transform.h;
  }

  const style = {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
    pointerEvents: "none" as const,
  };

  // Hide handles entirely when there's a multi-select — matches scope.
  const showHandles = selected.length === 1;

  return (
    <div className={styles.selectionBox} style={style}>
      {showHandles &&
        HANDLES.map((h) => (
          <div
            key={h.key}
            className={styles.handle}
            style={{
              left: `calc(${h.left} - 5px)`,
              top: `calc(${h.top} - 5px)`,
              cursor: h.cursor,
            }}
            onPointerDown={(event) => onHandlePointerDown(event, h.key)}
            aria-label={`Resize ${h.key}`}
          />
        ))}
    </div>
  );
}
