import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "../../utils/cx";
import styles from "./Checkbox.module.css";

type NativeProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type">;

export interface CheckboxProps extends NativeProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** When true, the checkbox renders the indeterminate state (hyphen mark). */
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { checked, onChange, indeterminate, disabled, className, onClick, onKeyDown, ...rest },
  ref,
) {
  const state = indeterminate ? "mixed" : checked;
  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={state}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className={cx(
        styles.root,
        (checked || indeterminate) && styles.filled,
        indeterminate && styles.indeterminate,
        className,
      )}
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
      {indeterminate ? (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <line
            x1="2"
            y1="5"
            x2="8"
            y2="5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      ) : checked ? (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <polyline
            points="1.5,5.5 4,8 8.5,2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </button>
  );
});
