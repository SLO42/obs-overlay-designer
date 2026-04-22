import { registerWidget, type WidgetDefinition } from "../registry";
import { textSchema, type TextProps } from "./schema";
import { TextRuntime } from "./Runtime";

export const textDefinition: WidgetDefinition<TextProps> = {
  kind: "text",
  label: "Text",
  description: "Plain styled text — headline, caption, stream title.",
  icon: "Type",
  schema: textSchema,
  defaults: () => textSchema.parse({}),
  defaultTransform: () => ({ w: 480, h: 120 }),
  Runtime: TextRuntime,
  eventsConsumed: [],
};

registerWidget(textDefinition);

export { textSchema } from "./schema";
export type { TextProps } from "./schema";
export { TextRuntime } from "./Runtime";
