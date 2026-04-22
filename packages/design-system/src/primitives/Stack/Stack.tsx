import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { cx } from "../../utils/cx";
import { spacing, type SpacingKey } from "../../tokens";
import styles from "./Stack.module.css";

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "column";
  gap?: SpacingKey;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  wrap?: boolean;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
  { direction = "column", gap = 3, align, justify, wrap, className, style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(styles.root, className)}
      style={{
        flexDirection: direction,
        gap: spacing(gap),
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? "wrap" : undefined,
        ...style,
      }}
      {...rest}
    />
  );
});
