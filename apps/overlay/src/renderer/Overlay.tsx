import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { EventBus, Project, StreamEvent } from "@obs/core";
import { WidgetHost } from "./WidgetHost";

export interface OverlayProps {
  project: Project;
  // `bus` is accepted for API parity with widget runtimes that will
  // eventually subscribe via props. Current widget runtimes (text, image)
  // don't consume events, so `bus` is unused at render time here.
  bus: EventBus<StreamEvent>;
}

/**
 * Top-level overlay renderer. Owns:
 *  - the `.stage` element sized to the project's canvas,
 *  - a ResizeObserver that recomputes the `--stage-scale` CSS var so the
 *    stage fits the viewport while preserving aspect ratio,
 *  - iteration of `project.widgets` in array order (bottom → top), skipping
 *    any `hidden` entries.
 *
 * The stage is centered in the viewport. Area outside the stage stays
 * transparent — OBS composites over whatever the streamer is capturing.
 */
export function Overlay({ project, bus }: OverlayProps) {
  // Silence the unused-param lint without reshaping the contract.
  void bus;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // Compute `scale = min(vw/cw, vh/ch)`, then translate by
  // `-cw*scale/2, -ch*scale/2` (expressed in px) so the scaled stage
  // centers on its top:50%/left:50% anchor. ResizeObserver fires for
  // any size change of the root; a window resize propagates to the root
  // because #root is 100vw×100vh.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const recompute = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const next = Math.min(rect.width / project.canvas.width, rect.height / project.canvas.height);
      setScale(next);
    };
    recompute();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", recompute);
      return () => window.removeEventListener("resize", recompute);
    }
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project.canvas.width, project.canvas.height]);

  // The stage's own top:50%/left:50% places its top-left at the viewport
  // center; we then translate back by half the scaled stage dimensions so
  // the stage itself is centered. Expressing both the translate and the
  // scale inline lets the GPU composite them as a single transform.
  const stageStyle: CSSProperties = {
    width: project.canvas.width,
    height: project.canvas.height,
    ["--stage-scale" as never]: String(scale),
    ["--stage-tx" as never]: `${-(project.canvas.width * scale) / 2}px`,
    ["--stage-ty" as never]: `${-(project.canvas.height * scale) / 2}px`,
  };

  // Hidden widgets are dropped entirely — the builder visualizes them with
  // a reduced-opacity affordance, but the overlay is a strict view.
  const visible = project.widgets.filter((w) => !w.hidden);

  // Flag used in dev to make sure the layout-effect ran at least once.
  // (Kept as a stable no-op effect so StrictMode double-invoke stays safe.)
  useEffect(() => {}, []);

  return (
    <div ref={rootRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <div className="stage" style={stageStyle}>
        {visible.map((widget, index) => (
          <WidgetHost key={widget.id} widget={widget} zIndex={index} />
        ))}
      </div>
    </div>
  );
}
