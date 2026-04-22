import { registerWidget, type WidgetDefinition } from "../registry";
import { customTriggerSchema, type CustomTriggerProps } from "./schema";
import { CustomTriggerRuntime } from "./Runtime";
import { CustomTriggerInspector } from "./Inspector";

/**
 * CustomTrigger widget: a non-rendering widget that subscribes to stream
 * events and fires effects on OTHER widgets' host elements. The widget is
 * invisible at runtime; the builder canvas shows a small labeled pill for
 * design-time visibility.
 *
 * Event subscription is the union of every enabled rule's matcher kind,
 * so the bus doesn't call back on irrelevant events. Target resolution
 * goes through `WidgetHostRegistry` at dispatch time.
 */
export const customTriggerDefinition: WidgetDefinition<CustomTriggerProps> = {
  kind: "custom-trigger",
  label: "Custom trigger",
  description: "Fires effects on other widgets when events match your rules.",
  icon: "Zap",
  schema: customTriggerSchema,
  defaults: () => customTriggerSchema.parse({}),
  // Tiny default box so the design-mode badge fits without taking up
  // canvas space. Authors can resize, but the widget is invisible at
  // runtime so the dimensions only matter in the builder.
  defaultTransform: () => ({ w: 240, h: 48 }),
  Runtime: CustomTriggerRuntime,
  Inspector: CustomTriggerInspector,
  eventsConsumed: [
    "chat.message",
    "channel.cheer",
    "channel.channel_points_custom_reward_redemption.add",
    "donation",
  ],
};

registerWidget(customTriggerDefinition);

export { customTriggerSchema } from "./schema";
export type {
  CustomTriggerProps,
  CustomTriggerRule,
  CustomTriggerMatcher,
  CustomTriggerEffect,
  Rule,
  Matcher,
  Effect,
} from "./schema";
export { CustomTriggerRuntime } from "./Runtime";
export { CustomTriggerInspector } from "./Inspector";
export {
  CanvasWidgetsContext,
  CanvasWidgetsProvider,
  useCanvasWidgets,
} from "./CanvasWidgetsContext";
export type { CanvasWidgetsView, CanvasWidgetsProviderProps } from "./CanvasWidgetsContext";

export default customTriggerDefinition;
