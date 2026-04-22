import type { Project, StreamEvent, EventBus } from "@obs/core";
import type { OverlayConfig } from "./boot";

/**
 * Messages the builder's live-preview iframe (Task 6) posts into the
 * overlay. All messages are origin-checked: we only accept messages whose
 * `event.origin` matches either `window.location.origin` (same-origin
 * mount, i.e. served from the same dev server) OR the origin of
 * `document.referrer` when the overlay is iframed.
 */
export type HostMessage =
  | { type: "overlay/config"; config: OverlayConfig }
  | { type: "overlay/patch-project"; patch: Partial<Project> }
  | { type: "overlay/fire-event"; event: StreamEvent }
  | { type: "overlay/fire-trigger"; widgetId: string; triggerId: string }
  | { type: "overlay/clear" };

export interface InstallHostOptions {
  /** React state setter for the current config. Called when the host replaces or patches. */
  setConfig: (
    next: OverlayConfig | null | ((prev: OverlayConfig | null) => OverlayConfig | null),
  ) => void;
  bus: EventBus<StreamEvent>;
}

/**
 * Resolves the origin string of `document.referrer`. Returns null when
 * the overlay is loaded top-level (no referrer) or when the referrer
 * URL is malformed.
 */
function referrerOrigin(): string | null {
  if (typeof document === "undefined") return null;
  const ref = document.referrer;
  if (!ref) return null;
  try {
    return new URL(ref).origin;
  } catch {
    return null;
  }
}

function isTrustedOrigin(origin: string): boolean {
  if (typeof window === "undefined") return false;
  if (origin === window.location.origin) return true;
  const ref = referrerOrigin();
  if (ref && origin === ref) return true;
  return false;
}

/**
 * Validates the shape of an incoming message without pulling in a schema
 * library. Anything that doesn't look right is dropped silently — the
 * builder owns the producer side and should never send us malformed data.
 */
function isHostMessage(value: unknown): value is HostMessage {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  if (typeof rec.type !== "string") return false;
  switch (rec.type) {
    case "overlay/config":
      return !!rec.config && typeof rec.config === "object";
    case "overlay/patch-project":
      return !!rec.patch && typeof rec.patch === "object";
    case "overlay/fire-event":
      return !!rec.event && typeof rec.event === "object";
    case "overlay/fire-trigger":
      return typeof rec.widgetId === "string" && typeof rec.triggerId === "string";
    case "overlay/clear":
      return true;
    default:
      return false;
  }
}

/**
 * For Task 5: shallow-merge at the project root and replace the widgets
 * array wholesale if present. Task 6 may need smarter per-widget patching;
 * if it does, swap this for a deep merge.
 */
function mergeProject(prev: Project, patch: Partial<Project>): Project {
  return {
    ...prev,
    ...patch,
    meta: patch.meta ? { ...prev.meta, ...patch.meta } : prev.meta,
    canvas: patch.canvas ? { ...prev.canvas, ...patch.canvas } : prev.canvas,
    widgets: patch.widgets ?? prev.widgets,
  };
}

/**
 * Installs the postMessage listener and announces readiness to the parent
 * window. Returns a cleanup function that removes the listener.
 */
export function installHost(opts: InstallHostOptions): () => void {
  const { setConfig, bus } = opts;

  const handler = (event: MessageEvent) => {
    if (!isTrustedOrigin(event.origin)) return;
    const data = event.data;
    if (!isHostMessage(data)) return;

    switch (data.type) {
      case "overlay/config":
        setConfig(data.config);
        return;
      case "overlay/patch-project":
        setConfig((prev) => {
          if (!prev) return prev;
          return { ...prev, project: mergeProject(prev.project, data.patch) };
        });
        return;
      case "overlay/fire-event":
        bus.emit(data.event);
        return;
      case "overlay/fire-trigger":
        // Trigger execution lands in Task 8 alongside the real event
        // sources. For now, log so the builder has a clean no-op target.
        console.info(
          `[overlay] fire-trigger ignored (not wired yet): widget=${data.widgetId} trigger=${data.triggerId}`,
        );
        return;
      case "overlay/clear":
        setConfig(null);
        return;
    }
  };

  window.addEventListener("message", handler);

  // Announce readiness so the builder knows the iframe has booted and is
  // ready to receive a config. `window.parent` is the window itself when
  // the overlay is top-level, which means this posts to ourselves — that's
  // harmless: the handler rejects it because there's no `type`/`config`.
  if (typeof window !== "undefined" && window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ type: "overlay/ready" }, "*");
    } catch (err) {
      console.error("[overlay] failed to post ready message", err);
    }
  }

  return () => {
    window.removeEventListener("message", handler);
  };
}
