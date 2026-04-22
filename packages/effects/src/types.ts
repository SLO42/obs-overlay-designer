import type { Effect } from "@obs/core";

/**
 * Callers invoke the `Cleanup` returned by a player to tear an effect down
 * early. Calling it a second time must be a no-op — the registry + every
 * player enforce idempotency so triggers that re-fire during cleanup don't
 * explode.
 */
export type Cleanup = () => void;

/**
 * Optional context threaded through each play call. All fields are
 * optional: a bare `playEffect(target, effect)` works. Tests use `raf`,
 * `cancelRaf`, and `now` to drive the particle simulations deterministically
 * without real timers; production code overrides none of them.
 */
export interface EffectContext {
  /** Source of emote URLs for emote-rain. Falls back to built-in data-URIs when absent. */
  emoteUrls?: string[];
  /** When true, effects must honor prefers-reduced-motion and become no-ops or near-no-ops. */
  respectReducedMotion?: boolean;
  /** now() override for tests. Defaults to performance.now. */
  now?: () => number;
  /** requestAnimationFrame override for tests. */
  raf?: (cb: (t: number) => void) => number;
  /** cancelAnimationFrame override for tests. */
  cancelRaf?: (id: number) => void;
}

/**
 * A player plays the effect on `target` once and returns a cleanup handle.
 * The handle must be safe to call more than once — the second call is
 * always a no-op.
 */
export type EffectPlayer<E extends Effect = Effect> = (
  target: HTMLElement,
  effect: E,
  ctx?: EffectContext,
) => Cleanup;

export interface EffectRegistry {
  register<E extends Effect["type"]>(
    type: E,
    player: EffectPlayer<Extract<Effect, { type: E }>>,
  ): void;
  get<E extends Effect["type"]>(type: E): EffectPlayer<Extract<Effect, { type: E }>> | undefined;
  all(): Map<Effect["type"], EffectPlayer>;
}
