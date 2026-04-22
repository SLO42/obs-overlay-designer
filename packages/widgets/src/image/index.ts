import { registerWidget, type WidgetDefinition } from "../registry";
import { imageSchema, type ImageProps } from "./schema";
import { ImageRuntime } from "./Runtime";

export const imageDefinition: WidgetDefinition<ImageProps> = {
  kind: "image",
  label: "Image",
  description: "Static image — logo, PNG overlay, border frame.",
  icon: "Image",
  schema: imageSchema,
  defaults: () => imageSchema.parse({}),
  defaultTransform: () => ({ w: 480, h: 320 }),
  Runtime: ImageRuntime,
  eventsConsumed: [],
};

registerWidget(imageDefinition);

export { imageSchema } from "./schema";
export type { ImageProps } from "./schema";
export { ImageRuntime } from "./Runtime";
