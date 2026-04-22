import { registerWidget, type WidgetDefinition } from "../registry";
import { alertBoxSchema, type AlertBoxProps } from "./schema";
import { AlertBoxRuntime } from "./Runtime";

export const alertBoxDefinition: WidgetDefinition<AlertBoxProps> = {
  kind: "alert-box",
  label: "Alert box",
  description: "Celebrates follows, subs, cheers, raids, and donations.",
  icon: "Sparkles",
  schema: alertBoxSchema,
  defaults: () => alertBoxSchema.parse({}),
  defaultTransform: () => ({ w: 560, h: 220 }),
  Runtime: AlertBoxRuntime,
  eventsConsumed: [
    "channel.follow",
    "channel.subscribe",
    "channel.subscription.gift",
    "channel.cheer",
    "channel.raid",
    "donation",
  ],
};

registerWidget(alertBoxDefinition);

export { alertBoxSchema } from "./schema";
export type { AlertBoxProps, EventTemplate, AlertMedia } from "./schema";
export { AlertBoxRuntime } from "./Runtime";
export {
  buildPlaceholders,
  interpolate,
  resolveAlert,
  eventKindToAlertKind,
  passesThreshold,
  tierLabel,
  countParts,
} from "./templates";
export type { PlaceholderMap, ResolvedAlert, AlertKind } from "./templates";
