import { registerWidget, type WidgetDefinition } from "../registry";
import { chatFeedSchema, type ChatFeedProps } from "./schema";
import { ChatFeedRuntime } from "./Runtime";

export const chatFeedDefinition: WidgetDefinition<ChatFeedProps> = {
  kind: "chat-feed",
  label: "Chat feed",
  description: "Live chat with badges, emotes, mentions.",
  icon: "MessageSquare",
  schema: chatFeedSchema,
  defaults: () => chatFeedSchema.parse({}),
  defaultTransform: () => ({ w: 420, h: 620 }),
  Runtime: ChatFeedRuntime,
  eventsConsumed: ["chat.message"],
};

registerWidget(chatFeedDefinition);

export { chatFeedSchema } from "./schema";
export type { ChatFeedProps } from "./schema";
export { ChatFeedRuntime } from "./Runtime";
