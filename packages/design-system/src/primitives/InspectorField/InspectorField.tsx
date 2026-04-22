import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../../utils/cx";
import styles from "./InspectorField.module.css";

export interface InspectorFieldProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}

export const InspectorField = forwardRef<HTMLDivElement, InspectorFieldProps>(
  function InspectorField(
    { label, description, error, htmlFor, className, children, ...rest },
    ref,
  ) {
    return (
      <div ref={ref} className={cx(styles.root, className)} {...rest}>
        <label className={cx("ds-label", styles.label)} htmlFor={htmlFor}>
          {label}
        </label>
        <div className={styles.control}>
          {children}
          {description && !error && (
            <div className={cx("ds-caption", styles.description)}>{description}</div>
          )}
          {error && <div className={styles.error}>{error}</div>}
        </div>
      </div>
    );
  },
);
