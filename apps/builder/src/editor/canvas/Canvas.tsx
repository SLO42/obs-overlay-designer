import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";
import type { Widget } from "@obs/core";
import { getWidget } from "@obs/widgets";
import { useEditorStore } from "../../store";
import { SelectionBox } from "./SelectionBox";
import { SnapGuides, type SnapLine } from "./SnapGuides";
import { computeDragSnap, computeResizeSnap } from "./snap";
import styles from "./Canvas.module.css";

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface DragState {
  kind: "move" | "resize";
  handle?: ResizeHandle;
  /** ids being dragged. */
  ids: string[];
  /** start transform keyed by widget id. */
  starts: Map<string, { x: number; y: number; w: number; h: number }>;
  /** origin in canvas coordinates. */
  originCanvasX: number;
  originCanvasY: number;
  /** shift-key state for aspect-lock on resize. */
  shift: boolean;
}

/**
 * Canvas pane — the stage host.
 *
 * Responsibilities:
 *  - Compute stage scale so the 1920×1080 art-board fits the viewport, then
 *    multiply by a user-controlled `zoom` (0.25..3).
 *  - Render every widget via its registered Runtime, inside transform-styled
 *    absolutely-positioned boxes.
 *  - Overlay selection + resize handles + snap guides.
 *  - Handle click-to-select, shift-click to toggle, drag-to-move, drag-a-
 *    handle-to-resize, middle-button pan, wheel-zoom, click-empty to clear.
 *
 * Not on the history stack: selection, zoom/pan. Those stay local state.
 */
export function Canvas() {
  const project = useEditorStore((s) => s.project);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const addToSelection = useEditorStore((s) => s.addToSelection);
  const removeFromSelection = useEditorStore((s) => s.removeFromSelection);
  const updateTransform = useEditorStore((s) => s.updateTransform);

  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Base "fit" scale computed from viewport size. The user-facing `zoom`
  // is on top of this so fit-to-view at zoom=1 always fills the pane.
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Drag + snap state. Drag state is imperative (lives in a ref) so the
  // pointermove handler never has to wait for React to rerender.
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(
    null,
  );
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);

  const scale = fitScale * zoom;

  // Recompute fit scale when viewport size or canvas dims change. Uses
  // ResizeObserver so the canvas resizes live with the rail drag, etc.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const recompute = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // Use 90% of the available space so there's padding around the
      // stage — keeps the drop shadow visible.
      const next = Math.min(
        (rect.width * 0.9) / project.canvas.width,
        (rect.height * 0.9) / project.canvas.height,
      );
      setFitScale(next);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project.canvas.width, project.canvas.height]);

  /** Convert a viewport client point to canvas coordinates. */
  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const stage = stageRef.current;
      if (!stage) return { x: 0, y: 0 };
      const rect = stage.getBoundingClientRect();
      // The stage is drawn at `scale`, so dividing by scale flips us back
      // into authoring coordinates.
      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      };
    },
    [scale],
  );

  // Widget pointer-down: either start a move drag or a selection toggle.
  const handleWidgetPointerDown = (event: ReactPointerEvent<HTMLDivElement>, widget: Widget) => {
    if (widget.locked) return;
    if (event.button !== 0) return;
    event.stopPropagation();

    let nextSelection = selection;
    if (event.shiftKey) {
      if (selection.includes(widget.id)) {
        removeFromSelection(widget.id);
        nextSelection = selection.filter((id) => id !== widget.id);
      } else {
        addToSelection(widget.id);
        nextSelection = [...selection, widget.id];
      }
    } else if (!selection.includes(widget.id)) {
      setSelection([widget.id]);
      nextSelection = [widget.id];
    }

    // Start move drag with whatever's now selected.
    const starts = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const id of nextSelection) {
      const w = project.widgets.find((wd) => wd.id === id);
      if (!w || w.locked) continue;
      starts.set(id, { x: w.transform.x, y: w.transform.y, w: w.transform.w, h: w.transform.h });
    }
    const origin = toCanvas(event.clientX, event.clientY);
    dragRef.current = {
      kind: "move",
      ids: Array.from(starts.keys()),
      starts,
      originCanvasX: origin.x,
      originCanvasY: origin.y,
      shift: event.shiftKey,
    };

    try {
      (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    } catch {
      /* ignore — synthetic events in tests have no active pointer */
    }
  };

  const handleHandlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    handle: ResizeHandle,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const starts = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const id of selection) {
      const w = project.widgets.find((wd) => wd.id === id);
      if (!w || w.locked) continue;
      starts.set(id, { x: w.transform.x, y: w.transform.y, w: w.transform.w, h: w.transform.h });
    }
    if (starts.size === 0) return;
    const origin = toCanvas(event.clientX, event.clientY);
    dragRef.current = {
      kind: "resize",
      handle,
      ids: Array.from(starts.keys()),
      starts,
      originCanvasX: origin.x,
      originCanvasY: origin.y,
      shift: event.shiftKey,
    };
    try {
      (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    } catch {
      /* ignore — synthetic events in tests have no active pointer */
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Middle-mouse pan has priority.
    if (panRef.current) {
      const dx = event.clientX - panRef.current.startX;
      const dy = event.clientY - panRef.current.startY;
      setPan({ x: panRef.current.panX + dx, y: panRef.current.panY + dy });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;

    const cur = toCanvas(event.clientX, event.clientY);
    const dx = cur.x - drag.originCanvasX;
    const dy = cur.y - drag.originCanvasY;
    const snapDistance = 6 / scale;

    if (drag.kind === "move") {
      // Compute snap offset using the bounding rect of the whole drag
      // selection so we snap consistently across multi-select moves.
      const rect = selectionStartRect(drag);
      if (!rect) return;
      const others = project.widgets.filter(
        (w) => !drag.ids.includes(w.id) && !w.hidden && !w.locked,
      );
      const snap = computeDragSnap(
        { x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h },
        project.canvas,
        others,
        snapDistance,
      );
      setSnapLines(snap.lines);
      for (const id of drag.ids) {
        const start = drag.starts.get(id);
        if (!start) continue;
        updateTransform(id, {
          x: Math.round(start.x + dx + snap.offsetX),
          y: Math.round(start.y + dy + snap.offsetY),
        });
      }
    } else if (drag.kind === "resize" && drag.handle) {
      const shift = event.shiftKey;
      for (const id of drag.ids) {
        const start = drag.starts.get(id);
        if (!start) continue;
        const next = applyResize(start, drag.handle, dx, dy, shift);
        // Snap the resulting bbox to other widgets' edges too — only when
        // a single widget is being resized (multi-select resize isn't in
        // scope, but snap still works for the single-widget case here).
        const others = project.widgets.filter(
          (w) => !drag.ids.includes(w.id) && !w.hidden && !w.locked,
        );
        const { rect, lines } = computeResizeSnap(
          next,
          drag.handle,
          project.canvas,
          others,
          snapDistance,
        );
        setSnapLines(lines);
        updateTransform(id, {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.max(8, Math.round(rect.w)),
          h: Math.max(8, Math.round(rect.h)),
        });
      }
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current) {
      panRef.current = null;
    }
    if (dragRef.current) {
      dragRef.current = null;
      setSnapLines([]);
    }
    try {
      (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleBackgroundPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Middle button → pan.
    if (event.button === 1) {
      event.preventDefault();
      panRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      try {
        (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
      } catch {
        /* ignore — synthetic events in tests have no active pointer */
      }
      return;
    }
    // Left click on empty canvas clears selection.
    if (event.button === 0 && event.target === event.currentTarget) {
      clearSelection();
    }
  };

  // Wheel: zoom when over canvas, anchored at cursor. Holding Ctrl gives
  // the classic "precision zoom" affordance used by most editors.
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = -event.deltaY;
    const factor = Math.exp(delta * 0.001);
    const nextZoom = Math.min(3, Math.max(0.25, zoom * factor));
    if (nextZoom === zoom) return;

    // Anchor the zoom on the cursor: keep the canvas point under the cursor
    // fixed in viewport coordinates.
    const viewport = viewportRef.current;
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      const centerX = rect.width / 2 + pan.x;
      const centerY = rect.height / 2 + pan.y;
      const ratio = nextZoom / zoom;
      const newPanX = pan.x + (cx - centerX) * (1 - ratio);
      const newPanY = pan.y + (cy - centerY) * (1 - ratio);
      setPan({ x: newPanX, y: newPanY });
    }
    setZoom(nextZoom);
  };

  // Click on the root (not viewport) should not clear selection — only
  // clicks directly on the stage-pad background should.
  const handleStagePadPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.button === 0) {
      clearSelection();
    }
  };

  // Reset pan when switching projects.
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [project.meta.id]);

  const stageStyle: CSSProperties = {
    width: project.canvas.width,
    height: project.canvas.height,
  };
  const wrapperStyle: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
  };

  return (
    <div className={styles.root} tabIndex={0} aria-label="Design canvas">
      <div className={styles.chromeTop}>
        <span className={styles.liveDot} aria-hidden="true" />
        <span>
          CANVAS {project.canvas.width} × {project.canvas.height}
        </span>
        <span className={styles.dim}>·</span>
        <span>scale {scale.toFixed(2)}</span>
        <span className={styles.dim}>·</span>
        <span>zoom {Math.round(zoom * 100)}%</span>
        <div style={{ flex: 1 }} />
        <span className={styles.dim}>widgets {project.widgets.length}</span>
      </div>
      <div
        ref={viewportRef}
        className={styles.viewport}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <div
          className={styles.stageWrapper}
          style={wrapperStyle}
          onPointerDown={handleStagePadPointerDown}
        >
          <div ref={stageRef} className={styles.stage} style={stageStyle}>
            {project.widgets.map((widget, idx) => (
              <CanvasWidget
                key={widget.id}
                widget={widget}
                zIndex={idx}
                selected={selection.includes(widget.id)}
                onPointerDown={(event) => handleWidgetPointerDown(event, widget)}
              />
            ))}
            <SnapGuides lines={snapLines} />
          </div>
          {/* Selection box is drawn inside the stage's transform so the
              handles scale with the stage. */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <SelectionBox
              selection={selection}
              widgets={project.widgets}
              onHandlePointerDown={handleHandlePointerDown}
            />
          </div>
        </div>
      </div>
      <div className={styles.chromeBottom}>
        <span className={styles.liveDot} aria-hidden="true" />
        <span>STAGE</span>
        <span className={styles.dim}>·</span>
        <span>{project.meta.name}</span>
        <div style={{ flex: 1 }} />
        <span className={styles.dim}>middle-drag to pan · wheel to zoom</span>
      </div>
    </div>
  );
}

/**
 * Computes the bounding rect of the drag selection using the start
 * transforms. Returns null if the drag has no widgets.
 */
function selectionStartRect(
  drag: DragState,
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const start of drag.starts.values()) {
    if (start.x < minX) minX = start.x;
    if (start.y < minY) minY = start.y;
    if (start.x + start.w > maxX) maxX = start.x + start.w;
    if (start.y + start.h > maxY) maxY = start.y + start.h;
  }
  if (!isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function applyResize(
  start: { x: number; y: number; w: number; h: number },
  handle: ResizeHandle,
  dx: number,
  dy: number,
  preserveAspect: boolean,
): { x: number; y: number; w: number; h: number } {
  let { x, y, w, h } = start;
  const east = handle.includes("e");
  const west = handle.includes("w");
  const north = handle.includes("n");
  const south = handle.includes("s");

  if (east) w = Math.max(8, start.w + dx);
  if (west) {
    const nextW = Math.max(8, start.w - dx);
    x = start.x + (start.w - nextW);
    w = nextW;
  }
  if (south) h = Math.max(8, start.h + dy);
  if (north) {
    const nextH = Math.max(8, start.h - dy);
    y = start.y + (start.h - nextH);
    h = nextH;
  }

  // Aspect lock for corner handles when shift is held.
  if (preserveAspect && east !== west && north !== south) {
    const aspect = start.w / start.h;
    if (w / h > aspect) {
      const nextH = w / aspect;
      if (north) y += h - nextH;
      h = nextH;
    } else {
      const nextW = h * aspect;
      if (west) x += w - nextW;
      w = nextW;
    }
  }
  return { x, y, w, h };
}

interface CanvasWidgetProps {
  widget: Widget;
  zIndex: number;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

function CanvasWidget({ widget, zIndex, selected, onPointerDown }: CanvasWidgetProps) {
  const def = getWidget(widget.kind);
  const t = widget.transform;

  const style: CSSProperties = {
    left: t.x,
    top: t.y,
    width: t.w,
    height: t.h,
    transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined,
    transformOrigin: `${(t.anchor?.x ?? 0.5) * 100}% ${(t.anchor?.y ?? 0.5) * 100}%`,
    zIndex,
  };

  const classes = [styles.widget, widget.hidden && styles.hidden, widget.locked && styles.locked]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={style}
      data-widget-id={widget.id}
      data-selected={selected ? "" : undefined}
      onPointerDown={onPointerDown}
    >
      {def ? (
        <def.Runtime widget={widget as Widget<never>} />
      ) : (
        <div style={{ color: "var(--fg-muted)" }}>Unknown widget: {widget.kind}</div>
      )}
    </div>
  );
}
