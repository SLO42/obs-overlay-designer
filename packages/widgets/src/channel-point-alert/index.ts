import { registerWidget, type WidgetDefinition } from "../registry";
import { channelPointAlertSchema, type ChannelPointAlertProps } from "./schema";
import { ChannelPointAlertRuntime } from "./Runtime";
import { ChannelPointAlertInspector } from "./Inspector";

export const channelPointAlertDefinition: WidgetDefinition<ChannelPointAlertProps> = {
  kind: "channel-point-alert",
  label: "Channel point alert",
  description: "Celebrates a specific channel-point redemption.",
  icon: "Gift",
  schema: channelPointAlertSchema,
  defaults: () => channelPointAlertSchema.parse({}),
  defaultTransform: () => ({ w: 480, h: 200 }),
  Runtime: ChannelPointAlertRuntime,
  // Custom inspector uses the connected Twitch session to surface a reward
  // picker for `rewardId`; falls back to the same controls the auto-form
  // would produce for everything else.
  Inspector: ChannelPointAlertInspector,
  eventsConsumed: ["channel.channel_points_custom_reward_redemption.add"],
};

registerWidget(channelPointAlertDefinition);

export { channelPointAlertSchema } from "./schema";
export type { ChannelPointAlertProps } from "./schema";
export { ChannelPointAlertRuntime } from "./Runtime";
export { ChannelPointAlertInspector } from "./Inspector";
