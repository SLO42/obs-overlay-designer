import { forwardRef } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cx } from "../../utils/cx";
import type { InputSize } from "../../tokens";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: InputSize;
  disabled?: boolean;
  invalid?: boolean;
  /** Accessible name — if the select has no external label. */
  "aria-label"?: string;
  className?: string;
  id?: string;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    value,
    onValueChange,
    options,
    placeholder = "Select…",
    size = "md",
    disabled,
    invalid,
    className,
    "aria-label": ariaLabel,
    id,
  },
  ref,
) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        ref={ref}
        className={cx(styles.trigger, styles[`size-${size}`], invalid && styles.invalid, className)}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        id={id}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className={styles.chevron} aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <polyline
              points="2,3.5 5,6.5 8,3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className={styles.content} position="popper" sideOffset={4}>
          <SelectPrimitive.Viewport className={styles.viewport}>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={styles.item}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
});
