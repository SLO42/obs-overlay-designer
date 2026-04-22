import { registerWidget, type WidgetDefinition } from "../registry";
import { emoteWallSchema, type EmoteWallProps } from "./schema";
import { EmoteWallRuntime } from "./Runtime";

export const emoteWallDefinition: WidgetDefinition<EmoteWallProps> = {
  kind: "emote-wall",
  label: "Emote wall",
  description: "Physics-simulated emotes triggered by chat.",
  icon: "Sparkles",
  schema: emoteWallSchema,
  defaults: () => emoteWallSchema.parse({}),
  defaultTransform: () => ({ w: 720, h: 520 }),
  Runtime: EmoteWallRuntime,
  eventsConsumed: ["chat.message"],
};

registerWidget(emoteWallDefinition);

export { emoteWallSchema } from "./schema";
export type { EmoteWallProps } from "./schema";
export { EmoteWallRuntime } from "./Runtime";
export { spawnParticle, stepParticle } from "./physics";
export type { Particle, World, EmoteWallMode, SpawnOptions } from "./physics";

export default emoteWallDefinition;
