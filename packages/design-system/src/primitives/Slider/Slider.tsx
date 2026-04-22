import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cx } from "../../utils/cx";
import styles from "./Slider.module.css";

type NativeProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "onKeyDown">;

export interface SliderProps extends NativeProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Optional accessible name (if there's no external <label> wrapping the field). */
  "aria-label"?: string;
  disabled?: boolean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function roundToStep(value: number, step: number, min: number): number {
  if (step <= 0) return value;
  const steps = Math.round((value - min) / step);
  const aligned = min + steps * step;
  // Avoid binary-float drift: round to at most 10 decimals.
  return Math.round(aligned * 1e10) / 1e10;
}

export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  {
    value,
    onChange,
    min = 0,
    max = 1,
    step = 0.01,
    disabled,
    className,
    "aria-label": ariaLabel,
    ...rest
  },
  ref,
) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const clamped = clamp(value, min, max);
  const percent = max === min ? 0 : ((clamped - min) / (max - min)) * 100;

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
      const raw = min + clamp(ratio, 0, 1) * (max - min);
      const next = clamp(roundToStep(raw, step, min), min, max);
      if (next !== value) onChange(next);
    },
    [max, min, onChange, step, value],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    draggingRef.current = true;
    setFromClientX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || disabled) return;
    setFromClientX(event.clientX);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore — pointer already released */
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const bigStep = Math.max(step, (max - min) / 10);
    let delta = 0;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        delta = -step;
        break;
      case "ArrowRight":
      case "ArrowUp":
        delta = step;
        break;
      case "PageDown":
        delta = -bigStep;
        break;
      case "PageUp":
        delta = bigStep;
        break;
      case "Home":
        event.preventDefault();
        if (clamped !== min) onChange(min);
        return;
      case "End":
        event.preventDefault();
        if (clamped !== max) onChange(max);
        return;
      default:
        return;
    }
    event.preventDefault();
    const next = clamp(roundToStep(clamped + delta, step, min), min, max);
    if (next !== clamped) onChange(next);
  };

  // Ensure value stays clamped if min/max change.
  useEffect(() => {
    const next = clamp(value, min, max);
    if (next !== value) onChange(next);
  }, [min, max]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className={cx(styles.root, disabled && styles.disabled, className)} {...rest}>
      <div
        ref={trackRef}
        className={styles.track}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-disabled={disabled || undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
        <div className={styles.thumb} style={{ left: `calc(${percent}% - 7px)` }} />
      </div>
    </div>
  );
});
