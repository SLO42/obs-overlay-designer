import { createContext, type ReactNode } from "react";
import { createEventBus, type EventBus } from "../eventBus";
import type { StreamEvent } from "../types/events";

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
