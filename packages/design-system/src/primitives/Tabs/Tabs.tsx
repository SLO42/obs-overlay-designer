import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cx } from "../../utils/cx";
import styles from "./Tabs.module.css";

type RootProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;

const Root = forwardRef<ElementRef<typeof TabsPrimitive.Root>, RootProps>(function TabsRoot(
  { className, ...rest },
  ref,
) {
  return <TabsPrimitive.Root ref={ref} className={cx(styles.root, className)} {...rest} />;
});

const List = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...rest }, ref) {
  return <TabsPrimitive.List ref={ref} className={cx(styles.list, className)} {...rest} />;
});

const Trigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...rest }, ref) {
  return <TabsPrimitive.Trigger ref={ref} className={cx(styles.trigger, className)} {...rest} />;
});

const Content = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...rest }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cx(styles.content, className)} {...rest} />;
});

type TabsComponent = typeof Root & {
  List: typeof List;
  Trigger: typeof Trigger;
  Content: typeof Content;
};

export const Tabs = Root as TabsComponent;
Tabs.List = List;
Tabs.Trigger = Trigger;
Tabs.Content = Content;

export type TabsProps = RootProps;
