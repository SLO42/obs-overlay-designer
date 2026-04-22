import type { Effect } from "@obs/core";
import type { Cleanup, EffectContext, EffectPlayer, EffectRegistry } from "./types";

const registry = new Map<Effect["type"], EffectPlayer>();

/**
 * Singleton registry. Each effect module side-effect-registers its player
 * on import. Consumers look up players via `effects.get(type)` or call
 * `playEffect` below.
 */
export const effects: EffectRegistry = {
  register(type, player) {
    if (registry.has(type)) {
      // eslint-disable-next-line no-console
      console.warn(`[effects] re-registering player for "${type}"`);
    }
    registry.set(type, player as EffectPlayer);
  },
  get(type) {
    return registry.get(type) as EffectPlayer<Extract<Effect, { type: typeof type }>> | undefined;
  },
  all() {
    return new Map(registry);
  },
};

/**
 * No-op cleanup singleton — returned whenever a play call fails (unknown
 * type, player threw). Having one shared instance makes it trivial to spot
 * "nothing happened" paths in tests.
 */
const NO_OP: Cleanup = () => {};

/**
 * Wrap a player's cleanup so it can only run once. Triggers that fire + are
 * cancelled rapidly should never double-free a player's resources.
 */
function once(fn: Cleanup): Cleanup {
  let ran = false;
  return () => {
    if (ran) return;
    ran = true;
    try {
      fn();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[effects] cleanup threw", err);
    }
  };
}

/**
 * Play an effect on `target`. Looks up the player by `effect.type`; if no
 * player is registered, logs and returns a no-op cleanup. Player exceptions
 * are caught so a misbehaving effect can't tear down the overlay.
 */
export function playEffect(target: HTMLElement, effect: Effect, ctx?: EffectContext): Cleanup {
  const player = registry.get(effect.type);
  if (!player) {
    // eslint-disable-next-line no-console
    console.warn(`[effects] no player registered for "${effect.type}"`);
    return NO_OP;
  }
  try {
    const cleanup = player(target, effect as never, ctx);
    return once(cleanup);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[effects] player for "${effect.type}" threw`, err);
    return NO_OP;
  }
}
