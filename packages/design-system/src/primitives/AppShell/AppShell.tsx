import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../../utils/cx";
import { TooltipProvider } from "../Tooltip";
import styles from "./AppShell.module.css";

export interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  toolbar: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}

/**
 * Three-column chrome: fixed 44px toolbar + body row made of left rail (56px),
 * main (flex 1), right rail (320px). Mounts a single TooltipProvider so every
 * `<Tooltip>` inside the tree shares the same delay.
 */
export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(function AppShell(
  { toolbar, left, right, children, className, ...rest },
  ref,
) {
  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={100}>
      <div ref={ref} className={cx(styles.root, className)} {...rest}>
        <header className={styles.toolbar}>{toolbar}</header>
        <div className={styles.body}>
          {left && <aside className={styles.left}>{left}</aside>}
          <main className={styles.main}>{children}</main>
          {right && <aside className={styles.right}>{right}</aside>}
        </div>
      </div>
    </TooltipProvider>
  );
});
