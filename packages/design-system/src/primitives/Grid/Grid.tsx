import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../../utils/cx";
import { spacing, type SpacingKey } from "../../tokens";
import styles from "./Grid.module.css";

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  columns: number | string;
  rows?: number | string;
  gap?: SpacingKey;
}

function track(value: number | string): string {
  return typeof value === "number" ? `repeat(${value}, minmax(0, 1fr))` : value;
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(function Grid(
  { columns, rows, gap = 3, className, style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(styles.root, className)}
      style={{
        gridTemplateColumns: track(columns),
        gridTemplateRows: rows != null ? track(rows) : undefined,
        gap: spacing(gap),
        ...style,
      }}
      {...rest}
    />
  );
});
