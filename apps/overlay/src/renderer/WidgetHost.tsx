import { useRef } from "react";
import type { Widget } from "@obs/core";
import { getWidget, useTriggerEngine } from "@obs/widgets";
import { transformStyle } from "./dom";

export interface WidgetHostProps {
  widget: Widget;
  /**
   * Overrides the widget's own `transform.zIndex`. We use the widget's
   * index in `project.widgets` so array order is the source of truth, as
   * the schema's JSDoc promises (index 0 is back, last is front).
   */
  zIndex: number;
}

/**
 * Wraps a single widget runtime with its transform-driven box. Overlay
 * has no selection, no handles, no locked behavior — those are builder
 * concerns. The only special case here is an unknown widget kind, which
 * renders a small muted fallback so a bad export doesn't silently drop
 * content.
 *
 * The trigger engine is mounted here (rather than inside each Runtime)
 * so visual effects wrap the entire widget box — a shake or flash moves
 * the whole card, not just its inner contents. The engine no-ops under
 * the default bus (builder Design mode), so the same wrapper works in
 * both environments.
 */
export function WidgetHost({ widget, zIndex }: WidgetHostProps) {
  const def = getWidget(widget.kind);
  const style = transformStyle(widget.transform, zIndex);
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Hook runs before the early unknown-widget return so React's hook
  // order is stable across renders even if a widget kind disappears from
  // the registry mid-flight. The engine no-ops when `hostRef.current` is
  // null or when no triggers/effects are authored.
  useTriggerEngine(widget, hostRef, { respectReducedMotion: true });

  if (!def) {
    return (
      <div ref={hostRef} style={style}>
        <div className="unknown-widget">[unknown widget: {widget.kind}]</div>
      </div>
    );
  }

  const Runtime = def.Runtime;
  return (
    <div ref={hostRef} style={style} data-widget-id={widget.id} data-widget-kind={widget.kind}>
      {/* Cast is safe: the registry keys Runtime by kind and the widget
          instance was created via that same kind. */}
      <Runtime widget={widget as Widget<never>} />
    </div>
  );
}
