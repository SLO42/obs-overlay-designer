// Side-effect imports register each widget with the singleton registry.
// The order determines palette order (text first, then image).
import "./text";
import "./image";

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
