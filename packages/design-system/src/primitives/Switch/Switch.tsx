import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "../../utils/cx";
import styles from "./Switch.module.css";

type NativeProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type">;

export interface SwitchProps extends NativeProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onChange, disabled, className, onClick, onKeyDown, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className={cx(styles.root, checked && styles.checked, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onChange(!checked);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onChange(!checked);
        }
      }}
      {...rest}
    >
      <span className={styles.thumb} />
    </button>
  );
});
