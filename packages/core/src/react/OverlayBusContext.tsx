import { createContext, type ReactNode } from "react";
import { createEventBus, type EventBus } from "../eventBus";
import type { StreamEvent } from "../types/events";

/**
 * Branded sentinel stamped onto the module-local no-op bus. Widget Runtimes
 * import this together with `isDefaultBus(bus)` to detect Design mode (the
 * builder canvas renders Runtimes without an `OverlayBusProvider`, so the
 * hook returns the default bus). The symbol is shared via `Symbol.for` so
 * the check still works across module-duplication edge cases (vite dev
 * cache, separate bundles, etc.).
 */
export const IS_DEFAULT_BUS = Symbol.for("@obs/core/overlay-bus/default");

/**
 * A shared no-op bus used as the context default. Every widget Runtime can
 * call `useEventBus()` without blowing up when rendered outside an
 * overlay — builder Design mode, isolated tests, and Storybook-style
 * scratch pages all fall through to this singleton. Emits go nowhere;
 * subscribers simply never fire.
 *
 * The overlay wraps its stage in `<OverlayBusProvider bus={overlayBus}>`
 * so the real bus takes over at render time.
 */
const noopBus: EventBus<StreamEvent> = createEventBus<StreamEvent>();
// Brand it so runtimes can cheaply distinguish Design mode from Live mode.
(noopBus as unknown as { [IS_DEFAULT_BUS]?: boolean })[IS_DEFAULT_BUS] = true;

/**
 * True when `bus` is the module's no-op default (i.e. no
 * `OverlayBusProvider` wrapped the Runtime). Runtimes use this to render a
 * static preview card in the builder canvas rather than a blank box.
 */
export function isDefaultBus(bus: EventBus<StreamEvent>): boolean {
  return (bus as unknown as { [IS_DEFAULT_BUS]?: boolean })[IS_DEFAULT_BUS] === true;
}

export const OverlayBusContext = createContext<EventBus<StreamEvent>>(noopBus);

export interface OverlayBusProviderProps {
  bus: EventBus<StreamEvent>;
  children: ReactNode;
}

/**
 * Thin wrapper around the context provider. Kept as its own component so
 * consumers don't need to import `OverlayBusContext` directly unless they
 * want to.
 */
export function OverlayBusProvider({ bus, children }: OverlayBusProviderProps) {
  return <OverlayBusContext.Provider value={bus}>{children}</OverlayBusContext.Provider>;
}
