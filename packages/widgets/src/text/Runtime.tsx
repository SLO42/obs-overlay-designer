import type { CSSProperties } from "react";
import type { Widget } from "@obs/core";
import type { TextProps } from "./schema";

/** Maps the schema's `fontFamily` enum to the DS CSS custom property. */
const FONT_VAR: Record<TextProps["fontFamily"], string> = {
  sans: "var(--font-sans)",
  mono: "var(--font-mono)",
  display: "var(--font-display)",
  "display-sketch": "var(--font-display-sketch)",
};

export interface TextRuntimeProps {
  widget: Widget<TextProps>;
}

/**
 * Static text renderer used by overlay + builder preview. Layout is
 * driven by the widget transform (applied by the caller) — this component
 * fills its container. Background padding/radius lives on the wrapper so
 * padding doesn't fight the text `align`; text styling lives on the inner
 * span so shadow + weight don't bleed onto the box.
 */
export function TextRuntime({ widget }: TextRuntimeProps) {
  const p = widget.props;

  const justifyContent =
    p.align === "left" ? "flex-start" : p.align === "right" ? "flex-end" : "center";

  const containerStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent,
    backgroundColor: p.background.color,
    paddingLeft: p.background.paddingX,
    paddingRight: p.background.paddingX,
    paddingTop: p.background.paddingY,
    paddingBottom: p.background.paddingY,
    borderRadius: p.background.radius,
    boxSizing: "border-box",
    overflow: "hidden",
  };

  const textStyle: CSSProperties = {
    fontFamily: FONT_VAR[p.fontFamily],
    fontSize: p.fontSize,
    fontWeight: Number(p.fontWeight),
    color: p.color,
    textAlign: p.align,
    letterSpacing: `${p.letterSpacing}em`,
    lineHeight: p.lineHeight,
    textShadow: p.textShadow.enabled
      ? `${p.textShadow.x}px ${p.textShadow.y}px ${p.textShadow.blur}px ${p.textShadow.color}`
      : undefined,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  return (
    <div style={containerStyle}>
      <span style={textStyle}>{p.content}</span>
    </div>
  );
}
