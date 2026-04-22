import { forwardRef, type InputHTMLAttributes } from "react";
import { cx } from "../../utils/cx";
import type { InputSize } from "../../tokens";
import styles from "./Input.module.css";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: InputSize;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", invalid, className, type, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type ?? "text"}
      aria-invalid={invalid || undefined}
      className={cx(styles.root, styles[`size-${size}`], invalid && styles.invalid, className)}
      {...rest}
    />
  );
});
