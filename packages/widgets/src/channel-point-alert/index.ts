import { registerWidget, type WidgetDefinition } from "../registry";
import { channelPointAlertSchema, type ChannelPointAlertProps } from "./schema";
import { ChannelPointAlertRuntime } from "./Runtime";

export const channelPointAlertDefinition: WidgetDefinition<ChannelPointAlertProps> = {
  kind: "channel-point-alert",
  label: "Channel point alert",
  description: "Celebrates a specific channel-point redemption.",
  icon: "Gift",
  schema: channelPointAlertSchema,
  defaults: () => channelPointAlertSchema.parse({}),
  defaultTransform: () => ({ w: 480, h: 200 }),
  Runtime: ChannelPointAlertRuntime,
  eventsConsumed: ["channel.channel_points_custom_reward_redemption.add"],
};

registerWidget(channelPointAlertDefinition);

export { channelPointAlertSchema } from "./schema";
export type { ChannelPointAlertProps } from "./schema";
export { ChannelPointAlertRuntime } from "./Runtime";
