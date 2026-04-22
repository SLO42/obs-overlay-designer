import type { CanvasSize, Widget } from "@obs/core";
import type { SnapLine } from "./SnapGuides";
import type { ResizeHandle } from "./Canvas";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AxisCandidate {
  /** Position on the axis (x for vertical, y for horizontal). */
  pos: number;
  /** Source rectangle used to draw the guide line endpoints. */
  source: Rect | "canvas-edge" | "canvas-center";
}

function rectCandidates(rect: Rect): { vertical: number[]; horizontal: number[] } {
  return {
    vertical: [rect.x, rect.x + rect.w / 2, rect.x + rect.w],
    horizontal: [rect.y, rect.y + rect.h / 2, rect.y + rect.h],
  };
}

/**
 * Build the list of snap targets derived from the canvas edges, canvas
 * center, and every other widget's edges + center. Separated per axis so
 * the drag math stays simple.
 */
function buildTargets(
  canvas: CanvasSize,
  others: Widget[],
): { vertical: AxisCandidate[]; horizontal: AxisCandidate[] } {
  const vertical: AxisCandidate[] = [
    { pos: 0, source: "canvas-edge" },
    { pos: canvas.width / 2, source: "canvas-center" },
    { pos: canvas.width, source: "canvas-edge" },
  ];
  const horizontal: AxisCandidate[] = [
    { pos: 0, source: "canvas-edge" },
    { pos: canvas.height / 2, source: "canvas-center" },
    { pos: canvas.height, source: "canvas-edge" },
  ];
  for (const w of others) {
    const rect = { x: w.transform.x, y: w.transform.y, w: w.transform.w, h: w.transform.h };
    const { vertical: vc, horizontal: hc } = rectCandidates(rect);
    for (const v of vc) vertical.push({ pos: v, source: rect });
    for (const h of hc) horizontal.push({ pos: h, source: rect });
  }
  return { vertical, horizontal };
}

interface DragSnapResult {
  offsetX: number;
  offsetY: number;
  lines: SnapLine[];
}

/**
 * For a move drag: given the current dragged rect, propose an offset that
 * snaps the nearest edge/center to the nearest target within `threshold`
 * canvas-space pixels. Returns (0,0) when nothing in range, and a list of
 * guide lines to render.
 */
export function computeDragSnap(
  rect: Rect,
  canvas: CanvasSize,
  others: Widget[],
  threshold: number,
): DragSnapResult {
  const targets = buildTargets(canvas, others);
  const sources = rectCandidates(rect);

  let offsetX = 0;
  let bestX = Infinity;
  const lines: SnapLine[] = [];
  let xTarget: AxisCandidate | null = null;
  let xSource = 0;
  for (const source of sources.vertical) {
    for (const target of targets.vertical) {
      const delta = target.pos - source;
      if (Math.abs(delta) < bestX && Math.abs(delta) <= threshold) {
        bestX = Math.abs(delta);
        offsetX = delta;
        xTarget = target;
        xSource = source;
      }
    }
  }

  let offsetY = 0;
  let bestY = Infinity;
  let yTarget: AxisCandidate | null = null;
  let ySource = 0;
  for (const source of sources.horizontal) {
    for (const target of targets.horizontal) {
      const delta = target.pos - source;
      if (Math.abs(delta) < bestY && Math.abs(delta) <= threshold) {
        bestY = Math.abs(delta);
        offsetY = delta;
        yTarget = target;
        ySource = source;
      }
    }
  }

  if (xTarget) {
    void xSource;
    const start =
      xTarget.source === "canvas-edge" || xTarget.source === "canvas-center"
        ? 0
        : Math.min(rect.y, xTarget.source.y);
    const end =
      xTarget.source === "canvas-edge" || xTarget.source === "canvas-center"
        ? canvas.height
        : Math.max(rect.y + rect.h, xTarget.source.y + xTarget.source.h);
    lines.push({ orientation: "vertical", pos: xTarget.pos, start, end });
  }
  if (yTarget) {
    void ySource;
    const start =
      yTarget.source === "canvas-edge" || yTarget.source === "canvas-center"
        ? 0
        : Math.min(rect.x, yTarget.source.x);
    const end =
      yTarget.source === "canvas-edge" || yTarget.source === "canvas-center"
        ? canvas.width
        : Math.max(rect.x + rect.w, yTarget.source.x + yTarget.source.w);
    lines.push({ orientation: "horizontal", pos: yTarget.pos, start, end });
  }

  return { offsetX, offsetY, lines };
}

interface ResizeSnapResult {
  rect: Rect;
  lines: SnapLine[];
}

/**
 * Snap the active edge(s) of a resize in progress to the nearest target.
 * Unlike the move case, the snap can only affect the edges being dragged
 * so the opposite edge stays fixed.
 */
export function computeResizeSnap(
  rect: Rect,
  handle: ResizeHandle,
  canvas: CanvasSize,
  others: Widget[],
  threshold: number,
): ResizeSnapResult {
  const targets = buildTargets(canvas, others);
  const east = handle.includes("e");
  const west = handle.includes("w");
  const north = handle.includes("n");
  const south = handle.includes("s");

  const lines: SnapLine[] = [];
  const next = { ...rect };

  const snapAxis = (current: number, candidates: AxisCandidate[]): AxisCandidate | null => {
    let best: AxisCandidate | null = null;
    let bestDelta = Infinity;
    for (const target of candidates) {
      const delta = Math.abs(target.pos - current);
      if (delta < bestDelta && delta <= threshold) {
        bestDelta = delta;
        best = target;
      }
    }
    return best;
  };

  if (east) {
    const snap = snapAxis(rect.x + rect.w, targets.vertical);
    if (snap) {
      next.w = Math.max(8, snap.pos - rect.x);
      lines.push({ orientation: "vertical", pos: snap.pos, start: 0, end: canvas.height });
    }
  }
  if (west) {
    const snap = snapAxis(rect.x, targets.vertical);
    if (snap) {
      const newX = snap.pos;
      const delta = rect.x - newX;
      next.x = newX;
      next.w = Math.max(8, rect.w + delta);
      lines.push({ orientation: "vertical", pos: snap.pos, start: 0, end: canvas.height });
    }
  }
  if (south) {
    const snap = snapAxis(rect.y + rect.h, targets.horizontal);
    if (snap) {
      next.h = Math.max(8, snap.pos - rect.y);
      lines.push({ orientation: "horizontal", pos: snap.pos, start: 0, end: canvas.width });
    }
  }
  if (north) {
    const snap = snapAxis(rect.y, targets.horizontal);
    if (snap) {
      const newY = snap.pos;
      const delta = rect.y - newY;
      next.y = newY;
      next.h = Math.max(8, rect.h + delta);
      lines.push({ orientation: "horizontal", pos: snap.pos, start: 0, end: canvas.width });
    }
  }
  return { rect: next, lines };
}
