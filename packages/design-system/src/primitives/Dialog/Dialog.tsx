import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cx } from "../../utils/cx";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Max content width. Default 480. */
  width?: number | string;
}

function DialogRoot({ open, onOpenChange, children, width = 480 }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={styles.content} style={{ maxWidth: width }}>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const Title = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...rest }, ref) {
  return <DialogPrimitive.Title ref={ref} className={cx(styles.title, className)} {...rest} />;
});

const Description = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cx(styles.description, className)}
      {...rest}
    />
  );
});

const Body = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function DialogBody(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={cx(styles.body, className)} {...rest} />;
});

const Footer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function DialogFooter(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={cx(styles.footer, className)} {...rest} />;
});

type DialogComponent = typeof DialogRoot & {
  Title: typeof Title;
  Description: typeof Description;
  Body: typeof Body;
  Footer: typeof Footer;
};

export const Dialog = DialogRoot as DialogComponent;
Dialog.Title = Title;
Dialog.Description = Description;
Dialog.Body = Body;
Dialog.Footer = Footer;
