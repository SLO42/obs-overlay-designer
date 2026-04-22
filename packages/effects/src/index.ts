// Side-effect imports register each effect player with the singleton
// registry. Order doesn't matter for behavior, but we keep it in the same
// order the `Effect` union is declared in `@obs/core` for readability.
import "./effects/shake";
import "./effects/flash";
import "./effects/zoomPunch";
import "./effects/confetti";
import "./effects/emoteRain";

export { effects, playEffect } from "./registry";
export type { Cleanup, EffectContext, EffectPlayer, EffectRegistry } from "./types";
export { prefersReducedMotion } from "./utils/prefersReducedMotion";
export { FALLBACK_EMOTE_SRCS } from "./effects/emoteRain";
