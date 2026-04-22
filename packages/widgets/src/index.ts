// Side-effect imports register each widget with the singleton registry.
// The order determines palette order (text first, then image, then chat-feed).
import "./text";
import "./image";
import "./chat-feed";

export {
  registerWidget,
  getWidget,
  allWidgets,
  createWidget,
  type WidgetDefinition,
  type WidgetEventKind,
  type CreateWidgetPreset,
} from "./registry";

export { textDefinition, textSchema, TextRuntime } from "./text";
export type { TextProps } from "./text";

export { imageDefinition, imageSchema, ImageRuntime } from "./image";
export type { ImageProps } from "./image";

export { chatFeedDefinition, chatFeedSchema, ChatFeedRuntime } from "./chat-feed";
export type { ChatFeedProps } from "./chat-feed";
