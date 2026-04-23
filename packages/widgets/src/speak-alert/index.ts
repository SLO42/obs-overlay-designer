import { registerWidget, type WidgetDefinition } from "../registry";
import { SpeakAlertRuntime } from "./Runtime";
import { SpeakAlertInspector } from "./Inspector";
import { speakAlertSchema, type SpeakAlertProps } from "./schema";

export const speakAlertDefinition: WidgetDefinition<SpeakAlertProps> = {
  kind: "speak-alert",
  label: "Speak alert",
  description: "Speaks message-bearing events aloud with emotion-synced animations.",
  icon: "Mic",
  schema: speakAlertSchema,
  defaults: () => speakAlertSchema.parse({}),
  defaultTransform: () => ({ w: 640, h: 260 }),
  Runtime: SpeakAlertRuntime,
  Inspector: SpeakAlertInspector,
  eventsConsumed: [
    "donation",
    "channel.cheer",
    "channel.subscribe",
    "channel.subscription.gift",
    "channel.follow",
    "channel.raid",
    "channel.channel_points_custom_reward_redemption.add",
  ],
};

registerWidget(speakAlertDefinition);

export { speakAlertSchema, DEFAULT_EMOTION_ANIMATIONS } from "./schema";
export type { SpeakAlertProps, EmotionAnimation } from "./schema";
export { SpeakAlertRuntime } from "./Runtime";
export { SpeakAlertInspector } from "./Inspector";

export default speakAlertDefinition;
