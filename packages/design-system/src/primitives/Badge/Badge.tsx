import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../../utils/cx";
import type { BadgeVariant } from "../../tokens";
import styles from "./Badge.module.css";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Animate the leading dot with the low-frequency opacity pulse. */
  pulse?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = "ok", pulse, className, children, ...rest },
  ref,
) {
  return (
    <span ref={ref} className={cx(styles.root, styles[`variant-${variant}`], className)} {...rest}>
      <span className={cx(styles.dot, pulse && styles.pulse)} aria-hidden="true" />
      {children}
    </span>
  );
});
