/**
 * Feature-detects the proposed `CanvasRenderingContext2D.drawElement` API
 * that would let us render live DOM into a canvas (the "html-in-canvas"
 * path). Not implemented anywhere at time of writing — this flag is set
 * purely so Task 5 can log which path a given OBS CEF build would take.
 *
 * The DOM renderer is the only one implemented in this task; canvas
 * support gets its first real implementation in Phase 2.
 */
export const canvasRenderer: boolean =
  typeof CanvasRenderingContext2D !== "undefined" &&
  "drawElement" in (CanvasRenderingContext2D.prototype as unknown as Record<string, unknown>);
