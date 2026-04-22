import { forwardRef, useEffect, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { cx } from "../../utils/cx";
import styles from "./ColorInput.module.css";

type NativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type" | "size"
>;

export interface ColorInputProps extends NativeProps {
  /** Normalized `#rrggbb` lowercase. */
  value: string;
  /** Receives normalized `#rrggbb` lowercase. */
  onChange: (value: string) => void;
  invalid?: boolean;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalize(input: string): string | null {
  const match = HEX_RE.exec(input.trim());
  if (!match) return null;
  let hex = match[1]!.toLowerCase();
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return `#${hex}`;
}

export const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(function ColorInput(
  { value, onChange, invalid, className, onBlur, ...rest },
  ref,
) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const commit = (raw: string) => {
    const normalized = normalize(raw);
    if (normalized && normalized !== value) {
      onChange(normalized);
      setText(normalized);
    } else if (!normalized) {
      setText(value);
    } else {
      setText(normalized);
    }
  };

  const handleNativeColor = (event: ChangeEvent<HTMLInputElement>) => {
    const normalized = normalize(event.target.value) ?? event.target.value.toLowerCase();
    setText(normalized);
    if (normalized !== value) onChange(normalized);
  };

  return (
    <div className={cx(styles.root, invalid && styles.invalid, className)}>
      <label className={styles.swatch} style={{ background: value }}>
        <input
          type="color"
          value={value}
          onChange={handleNativeColor}
          className={styles.nativeColor}
          aria-label="Pick color"
        />
      </label>
      <input
        ref={ref}
        className={styles.hex}
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => {
          commit(text);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(text);
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
        aria-invalid={invalid || undefined}
        spellCheck={false}
        {...rest}
      />
    </div>
  );
});
