import styles from "./Canvas.module.css";

export interface SnapLine {
  orientation: "vertical" | "horizontal";
  /** canvas-space position (x for vertical, y for horizontal). */
  pos: number;
  /** start + end along the perpendicular axis, in canvas space. */
  start: number;
  end: number;
}

interface SnapGuidesProps {
  lines: SnapLine[];
}

/**
 * Renders violet hairlines for each active snap line during a drag. The
 * parent stage already applies the canvas scale, so coordinates are in
 * authoring space.
 */
export function SnapGuides({ lines }: SnapGuidesProps) {
  if (lines.length === 0) return null;
  return (
    <>
      {lines.map((line, idx) => {
        const style =
          line.orientation === "vertical"
            ? {
                left: line.pos,
                top: Math.min(line.start, line.end),
                height: Math.abs(line.end - line.start),
              }
            : {
                top: line.pos,
                left: Math.min(line.start, line.end),
                width: Math.abs(line.end - line.start),
              };
        return (
          <div
            key={idx}
            className={`${styles.snapLine} ${
              line.orientation === "vertical" ? styles.vertical : styles.horizontal
            }`}
            style={style}
          />
        );
      })}
    </>
  );
}
