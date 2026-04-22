import type { ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cx } from "../../utils/cx";
import styles from "./Tooltip.module.css";

export type TooltipSide = "top" | "right" | "bottom" | "left";

export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: TooltipSide;
  sideOffset?: number;
  /** Override the delay before this tooltip opens. Inherits provider delay by default. */
  delayDuration?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the tooltip without dropping the trigger (e.g. for disabled buttons). */
  disabled?: boolean;
}

export function Tooltip({
  children,
  content,
  side = "top",
  sideOffset = 6,
  delayDuration,
  open,
  defaultOpen,
  onOpenChange,
  disabled,
}: TooltipProps) {
  if (disabled) return <>{children}</>;
  return (
    <TooltipPrimitive.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      delayDuration={delayDuration}
    >
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={sideOffset}
          className={cx(styles.content)}
        >
          {content}
          <TooltipPrimitive.Arrow className={styles.arrow} width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export interface TooltipProviderProps extends TooltipPrimitive.TooltipProviderProps {}

export const TooltipProvider = TooltipPrimitive.Provider;
