import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../utils/cx";
import type { ButtonSize, ButtonVariant } from "../../tokens";
import { Kbd } from "../Kbd";
import styles from "./Button.module.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Row-height driven size. `sm` → 26, `md` → 30 (default), `lg` → 36. */
  size?: ButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Optional keyboard-shortcut hint rendered as a <Kbd> at the right edge. */
  kbd?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    leading,
    trailing,
    kbd,
    className,
    type,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cx(styles.root, styles[`variant-${variant}`], styles[`size-${size}`], className)}
      {...rest}
    >
      {leading != null && <span className={styles.slot}>{leading}</span>}
      {children != null && <span className={styles.label}>{children}</span>}
      {trailing != null && <span className={styles.slot}>{trailing}</span>}
      {kbd && (
        <Kbd className={styles.kbd} aria-hidden="true">
          {kbd}
        </Kbd>
      )}
    </button>
  );
});
