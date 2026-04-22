import { registerWidget, type WidgetDefinition } from "../registry";
import { eventTickerSchema, type EventTickerProps } from "./schema";
import { EventTickerRuntime } from "./Runtime";

export const eventTickerDefinition: WidgetDefinition<EventTickerProps> = {
  kind: "event-ticker",
  label: "Event ticker",
  description: "Scrolling marquee of recent stream events.",
  icon: "Megaphone",
  schema: eventTickerSchema,
  defaults: () => eventTickerSchema.parse({}),
  defaultTransform: () => ({ w: 1200, h: 48 }),
  Runtime: EventTickerRuntime,
  eventsConsumed: [
    "channel.follow",
    "channel.subscribe",
    "channel.subscription.gift",
    "channel.cheer",
    "channel.raid",
    "channel.channel_points_custom_reward_redemption.add",
    "donation",
    "chat.message",
  ],
};

registerWidget(eventTickerDefinition);

export { eventTickerSchema } from "./schema";
export type { EventTickerProps } from "./schema";
export { EventTickerRuntime, formatAmount, relativeTime } from "./Runtime";
