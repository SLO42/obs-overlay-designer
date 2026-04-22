import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../../utils/cx";
import styles from "./Kbd.module.css";

export type KbdProps = HTMLAttributes<HTMLElement>;

export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd(
  { className, children, ...rest },
  ref,
) {
  return (
    <kbd ref={ref} className={cx("ds-kbd", styles.root, className)} {...rest}>
      {children}
    </kbd>
  );
});
