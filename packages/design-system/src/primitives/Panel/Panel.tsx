import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../../utils/cx";
import { spacing, type SpacingKey, type Tone } from "../../tokens";
import styles from "./Panel.module.css";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  padding?: SpacingKey;
  tone?: Tone;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { padding = 4, tone = "default", className, style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(styles.root, styles[`tone-${tone}`], className)}
      style={{ padding: spacing(padding), ...style }}
      {...rest}
    />
  );
});
