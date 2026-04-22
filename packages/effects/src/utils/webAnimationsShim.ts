/**
 * Minimal Web Animations API shim. Only applied when `Element.prototype.animate`
 * is missing — real browsers are untouched. We need this because happy-dom
 * (the test env) doesn't ship WAAPI, but `shake` and `zoom-punch` rely on
 * `target.animate()` + `target.getAnimations()` in production.
 *
 * The shim is intentionally tiny: it stores animations in a per-element
 * WeakMap, returns a stub `Animation`-ish object with `cancel()` + a
 * `finished`/`ready` Promise that resolves after `durationMs`, and supports
 * `getAnimations()` lookup. That's enough for the 5 effect players + their
 * tests; we are not implementing the real spec.
 */

export interface ShimKeyframe {
  [prop: string]: string | number;
}

export interface ShimAnimationOptions {
  duration?: number;
  easing?: string;
  iterations?: number;
  fill?: "none" | "forwards" | "backwards" | "both" | "auto";
}

export interface ShimAnimation {
  cancel(): void;
  finish(): void;
  readonly keyframes: readonly ShimKeyframe[];
  readonly options: ShimAnimationOptions;
  readonly finished: Promise<void>;
  readonly ready: Promise<void>;
  onfinish: (() => void) | null;
  oncancel: (() => void) | null;
  effect: { getKeyframes: () => ShimKeyframe[] };
}

const animationsByElement: WeakMap<Element, Set<ShimAnimation>> = new WeakMap();

function attachShim(): void {
  const GlobalElement = (globalThis as { Element?: { prototype: unknown } }).Element;
  if (!GlobalElement) return;
  const proto = GlobalElement.prototype as Record<string, unknown>;
  if (typeof proto.animate === "function") return;

  proto.animate = function (
    this: Element,
    keyframes: ShimKeyframe[],
    options: ShimAnimationOptions = {},
  ): ShimAnimation {
    const duration = typeof options.duration === "number" ? options.duration : 0;
    let resolveFinished: (() => void) | null = null;
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    const ready = Promise.resolve();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const animation: ShimAnimation = {
      keyframes,
      options,
      finished,
      ready,
      onfinish: null,
      oncancel: null,
      effect: { getKeyframes: () => keyframes.slice() },
      cancel() {
        if (cancelled) return;
        cancelled = true;
        if (timer) clearTimeout(timer);
        const set = animationsByElement.get(this as unknown as Element);
        // `this` inside cancel refers to animation, so use closure instead.
        const own = animationsByElement.get(self);
        own?.delete(animation);
        void set;
        animation.oncancel?.();
      },
      finish() {
        if (cancelled) return;
        if (timer) clearTimeout(timer);
        cancelled = true;
        animationsByElement.get(self)?.delete(animation);
        animation.onfinish?.();
        resolveFinished?.();
      },
    };

    const self = this;
    let bucket = animationsByElement.get(self);
    if (!bucket) {
      bucket = new Set<ShimAnimation>();
      animationsByElement.set(self, bucket);
    }
    bucket.add(animation);

    if (duration > 0) {
      timer = setTimeout(() => {
        if (cancelled) return;
        cancelled = true;
        animationsByElement.get(self)?.delete(animation);
        animation.onfinish?.();
        resolveFinished?.();
      }, duration);
    } else {
      // Zero-duration — schedule a microtask so `finished` resolves after
      // the current turn, matching real WAAPI semantics.
      queueMicrotask(() => {
        if (cancelled) return;
        cancelled = true;
        animationsByElement.get(self)?.delete(animation);
        animation.onfinish?.();
        resolveFinished?.();
      });
    }

    return animation;
  } as unknown as (k: ShimKeyframe[], o?: ShimAnimationOptions) => ShimAnimation;

  proto.getAnimations = function (this: Element): ShimAnimation[] {
    const set = animationsByElement.get(this);
    return set ? Array.from(set) : [];
  } as unknown as () => ShimAnimation[];
}

/**
 * Attach the WAAPI shim on first import. Safe to import from multiple
 * effect modules — the function short-circuits when `.animate` is already
 * present.
 */
export function ensureWebAnimationsShim(): void {
  attachShim();
}

// Auto-apply on module load so effect players can `target.animate(...)`
// without each one importing this file.
ensureWebAnimationsShim();
