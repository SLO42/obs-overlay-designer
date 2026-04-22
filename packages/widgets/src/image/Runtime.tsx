import type { CSSProperties } from "react";
import type { Widget } from "@obs/core";
import { Icon } from "@obs/design-system";
import type { ImageProps } from "./schema";

export interface ImageRuntimeProps {
  widget: Widget<ImageProps>;
}

/**
 * Image widget renderer. Handles:
 * - `object-fit` via `fit`
 * - `flipX/flipY` via a `transform: scale(...)` on the `<img>`
 * - Optional `tint`: an absolutely-positioned sibling using the chosen
 *   `mix-blend-mode`. We do NOT use filter() because multiply/screen are not
 *   color filters — they blend against the image underneath.
 * - Placeholder when `src === ""`: dashed bordered rectangle with centered
 *   icon + caption, drawn with DS tokens so the builder preview looks right.
 */
export function ImageRuntime({ widget }: ImageRuntimeProps) {
  const p = widget.props;

  const containerStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
    opacity: p.opacity,
  };

  if (p.src === "") {
    const placeholderStyle: CSSProperties = {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      border: "1px dashed var(--border-default)",
      borderRadius: 8,
      color: "var(--fg-muted)",
      boxSizing: "border-box",
    };
    return (
      <div style={containerStyle}>
        <div style={placeholderStyle}>
          <Icon name="Image" size={32} />
          <span className="ds-caption">No image</span>
        </div>
      </div>
    );
  }

  const scaleX = p.flipX ? -1 : 1;
  const scaleY = p.flipY ? -1 : 1;

  const imgStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: p.fit,
    transform: `scale(${scaleX}, ${scaleY})`,
    display: "block",
  };

  const tintStyle: CSSProperties | undefined = p.tint.enabled
    ? {
        position: "absolute",
        inset: 0,
        backgroundColor: p.tint.color,
        mixBlendMode: p.tint.blendMode,
        pointerEvents: "none",
      }
    : undefined;

  return (
    <div style={containerStyle}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt is driven by props */}
      <img src={p.src} alt={p.alt} style={imgStyle} draggable={false} />
      {tintStyle ? <div style={tintStyle} /> : null}
    </div>
  );
}
