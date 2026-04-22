import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { cx } from "../../utils/cx";
import type { InputSize } from "../../tokens";
import styles from "./NumberField.module.css";

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "size" | "type" | "min" | "max" | "step"
>;

export interface NumberFieldProps extends NativeInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Number of decimal digits to render / allow. 0 means integer. Default 0. */
  precision?: number;
  size?: InputSize;
  /** Suffix shown inside the field (e.g. `px`, `ms`). */
  suffix?: string;
  invalid?: boolean;
}

function clamp(n: number, min?: number, max?: number): number {
  let out = n;
  if (typeof min === "number" && out < min) out = min;
  if (typeof max === "number" && out > max) out = max;
  return out;
}

function format(n: number, precision: number): string {
  if (!Number.isFinite(n)) return "";
  if (precision <= 0) return String(Math.round(n));
  return n.toFixed(precision);
}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  {
    value,
    onChange,
    min,
    max,
    step = 1,
    precision = 0,
    size = "md",
    suffix,
    invalid,
    className,
    onBlur,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const [text, setText] = useState(() => format(value, precision));
  const lastValid = useRef(value);

  // Sync external value changes into the text box, unless the user is mid-edit
  // and the value actually matches the parsed text (avoid clobbering "1." etc.).
  useEffect(() => {
    lastValid.current = value;
    const parsed = Number.parseFloat(text);
    if (!Number.isFinite(parsed) || parsed !== value) {
      setText(format(value, precision));
    }
  }, [value, precision]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback(
    (raw: string) => {
      const parsed = Number.parseFloat(raw);
      if (!Number.isFinite(parsed)) {
        setText(format(lastValid.current, precision));
        return;
      }
      const next = clamp(parsed, min, max);
      lastValid.current = next;
      setText(format(next, precision));
      if (next !== value) onChange(next);
    },
    [max, min, onChange, precision, value],
  );

  const bump = useCallback(
    (multiplier: number) => {
      const base = Number.isFinite(Number.parseFloat(text))
        ? Number.parseFloat(text)
        : lastValid.current;
      const next = clamp(base + step * multiplier, min, max);
      const rounded = precision > 0 ? Number.parseFloat(next.toFixed(precision)) : Math.round(next);
      lastValid.current = rounded;
      setText(format(rounded, precision));
      if (rounded !== value) onChange(rounded);
    },
    [text, step, min, max, precision, value, onChange],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? 1 : -1;
      let mult = direction;
      if (event.shiftKey) mult = direction * 10;
      else if (event.altKey) mult = direction * 0.1;
      bump(mult);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit(text);
      (event.currentTarget as HTMLInputElement).blur();
    }
    onKeyDown?.(event);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
  };

  return (
    <div className={cx(styles.root, styles[`size-${size}`], invalid && styles.invalid, className)}>
      <input
        ref={ref}
        className={styles.input}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          commit(text);
          onBlur?.(event);
        }}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      {suffix && <span className={styles.suffix}>{suffix}</span>}
    </div>
  );
});
