// Side-effect imports register each widget with the singleton registry.
// The order determines palette order.
import "./text";
import "./image";
import "./chat-feed";
import "./alert-box";
import "./channel-point-alert";

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

export {
  alertBoxDefinition,
  alertBoxSchema,
  AlertBoxRuntime,
  buildPlaceholders,
  interpolate,
  resolveAlert,
  eventKindToAlertKind,
  tierLabel,
  countParts,
} from "./alert-box";
export type {
  AlertBoxProps,
  EventTemplate,
  AlertMedia,
  PlaceholderMap,
  ResolvedAlert,
  AlertKind,
} from "./alert-box";

export {
  channelPointAlertDefinition,
  channelPointAlertSchema,
  ChannelPointAlertRuntime,
} from "./channel-point-alert";
export type { ChannelPointAlertProps } from "./channel-point-alert";
