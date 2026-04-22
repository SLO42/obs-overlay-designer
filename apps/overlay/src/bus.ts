import { createEventBus, type StreamEvent } from "@obs/core";

/**
 * Singleton event bus for the overlay runtime. External sources
 * (EventSub, Streamlabs — Task 8) and the postMessage host (Task 6 driver)
 * feed this bus; widget runtimes subscribe via their declared
 * `eventsConsumed` kinds.
 */
export const overlayBus = createEventBus<StreamEvent>();

/** Convenience wrapper used by the host message handler and (future) sources. */
export function fireEvent(event: StreamEvent): void {
  overlayBus.emit(event);
}
