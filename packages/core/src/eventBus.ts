export type Listener<E> = (event: E) => void;

export interface EventBus<E> {
  emit(event: E): void;
  /** returns unsubscribe */
  on(listener: Listener<E>): () => void;
  onKind<K extends string>(kind: K, listener: Listener<Extract<E, { kind: K }>>): () => void;
  clear(): void;
}

/**
 * Tiny typed pub/sub with zero runtime dependencies.
 *
 * Listeners fire in the order they were registered. Unsubscribing removes
 * exactly one listener. `onKind` filters by the `kind` discriminant; the
 * listener is strongly typed to the matching variant of the union.
 */
export function createEventBus<E extends { kind: string }>(): EventBus<E> {
  const listeners: Array<Listener<E>> = [];

  return {
    emit(event: E) {
      // Snapshot so mutations during dispatch don't affect the current iteration.
      const snapshot = listeners.slice();
      for (const listener of snapshot) {
        listener(event);
      }
    },
    on(listener: Listener<E>) {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx !== -1) {
          listeners.splice(idx, 1);
        }
      };
    },
    onKind<K extends string>(kind: K, listener: Listener<Extract<E, { kind: K }>>) {
      const wrapped: Listener<E> = (event) => {
        if (event.kind === kind) {
          listener(event as Extract<E, { kind: K }>);
        }
      };
      listeners.push(wrapped);
      return () => {
        const idx = listeners.indexOf(wrapped);
        if (idx !== -1) {
          listeners.splice(idx, 1);
        }
      };
    },
    clear() {
      listeners.length = 0;
    },
  };
}
