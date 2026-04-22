import { useEffect, useMemo, useRef, useState } from "react";
import { makePreviewUrl, type HostMessage } from "@obs/overlay";
import type { StreamEvent } from "@obs/core";
import { useEditorStore } from "../../store";
import { PREVIEW_FIRE_EVENT } from "../Toolbar";
import styles from "./PreviewPane.module.css";

/**
 * Live-preview iframe pane. Posts incremental `overlay/patch-project`
 * messages to the overlay iframe whenever the project changes (debounced
 * 50ms) so typing in the inspector updates the preview with no visible
 * lag. Receives `overlay/ready` before starting to post — prevents the
 * first-boot race where messages arrive before the overlay installs its
 * host listener.
 *
 * Dev uses `http://localhost:5174` as the iframe base. In Task 7 the
 * exported bundle will be a single HTML file and this iframe won't need
 * the dev origin at all.
 */
const OVERLAY_DEV_BASE = "http://localhost:5174/";

export function PreviewPane() {
  const project = useEditorStore((s) => s.project);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  // Base URL (initial project) only — subsequent changes are pushed via
  // postMessage to keep the iframe alive (a src change would reload it).
  const initialUrl = useMemo(() => makePreviewUrl(project, { base: OVERLAY_DEV_BASE }), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally stable

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data && typeof event.data === "object" && event.data.type === "overlay/ready") {
        setReady(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Debounced patch stream. Each project change schedules a 50ms timer;
  // subsequent changes within that window coalesce.
  useEffect(() => {
    if (!ready) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const timer = window.setTimeout(() => {
      const msg: HostMessage = { type: "overlay/patch-project", patch: project };
      iframe.contentWindow?.postMessage(msg, "*");
    }, 50);
    return () => window.clearTimeout(timer);
  }, [project, ready]);

  // Listen for the toolbar's "fire test event" CustomEvent and forward
  // it into the iframe's bus.
  useEffect(() => {
    const handler = (event: Event) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const detail = (event as CustomEvent<StreamEvent>).detail;
      if (!detail) return;
      const msg: HostMessage = { type: "overlay/fire-event", event: detail };
      iframe.contentWindow.postMessage(msg, "*");
    };
    window.addEventListener(PREVIEW_FIRE_EVENT, handler);
    return () => window.removeEventListener(PREVIEW_FIRE_EVENT, handler);
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.chrome}>
        <span className={styles.liveDot} aria-hidden="true" />
        <span>LIVE PREVIEW</span>
        <span>·</span>
        <span>
          {project.canvas.width} × {project.canvas.height}
        </span>
        <div style={{ flex: 1 }} />
        <span>{ready ? "overlay ready" : "booting…"}</span>
      </div>
      <div className={styles.viewport}>
        <div className={styles.frame}>
          <iframe
            ref={iframeRef}
            className={styles.iframe}
            src={initialUrl}
            title="Overlay preview"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
