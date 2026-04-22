import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../../utils/cx";
import styles from "./ScrollArea.module.css";

export type ScrollAreaProps = HTMLAttributes<HTMLDivElement>;

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={cx(styles.root, className)} {...rest} />;
});
