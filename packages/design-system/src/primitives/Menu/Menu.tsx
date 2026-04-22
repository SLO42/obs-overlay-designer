import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cx } from "../../utils/cx";
import styles from "./Menu.module.css";

export interface MenuProps {
  /** The element that opens the menu. Rendered via Radix `asChild`. */
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

function MenuRoot({
  trigger,
  children,
  open,
  defaultOpen,
  onOpenChange,
  side = "bottom",
  align = "start",
  sideOffset = 6,
}: MenuProps) {
  return (
    <DropdownMenu.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.content}
          side={side}
          align={align}
          sideOffset={sideOffset}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const Item = forwardRef<
  ElementRef<typeof DropdownMenu.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenu.Item>
>(function MenuItem({ className, ...rest }, ref) {
  return <DropdownMenu.Item ref={ref} className={cx(styles.item, className)} {...rest} />;
});

const Separator = forwardRef<
  ElementRef<typeof DropdownMenu.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenu.Separator>
>(function MenuSeparator({ className, ...rest }, ref) {
  return <DropdownMenu.Separator ref={ref} className={cx(styles.separator, className)} {...rest} />;
});

export interface MenuSubProps {
  label: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}

function Sub({ label, children, disabled }: MenuSubProps) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className={styles.item} disabled={disabled}>
        <span className={styles.itemLabel}>{label}</span>
        <span className={styles.subChevron} aria-hidden="true">
          ›
        </span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className={styles.content} sideOffset={4} alignOffset={-4}>
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

type MenuComponent = typeof MenuRoot & {
  Item: typeof Item;
  Separator: typeof Separator;
  Sub: typeof Sub;
};

export const Menu = MenuRoot as MenuComponent;
Menu.Item = Item;
Menu.Separator = Separator;
Menu.Sub = Sub;
