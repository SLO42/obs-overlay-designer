import { useContext } from "react";
import type { EventBus } from "../eventBus";
import type { StreamEvent } from "../types/events";
import { OverlayBusContext } from "./OverlayBusContext";

/**
 * Widget Runtimes call this to subscribe to stream events. Outside an
 * `OverlayBusProvider` it returns a no-op bus — builder Design mode,
 * isolated component tests, and the `<TextRuntime />` preview on a static
 * page all fall through to the context default.
 */
export function useEventBus(): EventBus<StreamEvent> {
  return useContext(OverlayBusContext);
}
