import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "../../utils/cx";
import type { ButtonSize } from "../../tokens";
import styles from "./IconButton.module.css";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — icon buttons have no text, so an accessible name is mandatory. */
  "aria-label": string;
  size?: ButtonSize;
  /** Renders the button with the violet-tinted selected appearance. */
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = "md", active, className, type, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-pressed={active ? true : undefined}
      data-active={active ? "" : undefined}
      className={cx(styles.root, styles[`size-${size}`], active && styles.active, className)}
      {...rest}
    >
      {children}
    </button>
  );
});
