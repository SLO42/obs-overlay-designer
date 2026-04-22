import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

/**
 * Runtime-side directory of widget id → host DOM element. Populated by each
 * widget's wrapper (overlay's `WidgetHost`) when the host ref attaches,
 * drained on unmount. Consumers (e.g. the CustomTrigger runtime) use it to
 * reach outside their own subtree and apply effects to sibling widgets.
 *
 * The registry is intentionally imperative and mutable-by-reference: its
 * value object is stable for the provider's lifetime, so consumers don't
 * re-render when registrations change. Only the registry's own
 * register/unregister calls drive changes to its internal Map.
 */
export interface WidgetHostRegistry {
  register(widgetId: string, el: HTMLElement | null): void;
  unregister(widgetId: string): void;
  get(widgetId: string): HTMLElement | null;
  /** All currently-registered widget ids. Useful for tests + Inspector targeting. */
  ids(): string[];
}

export const WidgetHostRegistryContext = createContext<WidgetHostRegistry | null>(null);

export interface WidgetHostRegistryProviderProps {
  children: ReactNode;
}

/**
 * Wraps children in a shared registry context. Each `WidgetHost` calls
 * `useRegisterHost(widgetId, hostEl)` on mount; CustomTrigger runtimes
 * call `useWidgetHostRegistry()` + `get(id)` to resolve targets when
 * events fire.
 *
 * The registry value is memoized so the object identity never changes —
 * consumers reading from it via ref closures never see a stale snapshot,
 * and nothing re-renders when ids come and go.
 */
export function WidgetHostRegistryProvider({ children }: WidgetHostRegistryProviderProps) {
  const mapRef = useRef<Map<string, HTMLElement>>();
  if (!mapRef.current) {
    mapRef.current = new Map<string, HTMLElement>();
  }

  const value = useMemo<WidgetHostRegistry>(() => {
    const map = mapRef.current!;
    return {
      register(widgetId, el) {
        if (el === null) {
          map.delete(widgetId);
          return;
        }
        map.set(widgetId, el);
      },
      unregister(widgetId) {
        map.delete(widgetId);
      },
      get(widgetId) {
        return map.get(widgetId) ?? null;
      },
      ids() {
        return Array.from(map.keys());
      },
    };
  }, []);

  return (
    <WidgetHostRegistryContext.Provider value={value}>
      {children}
    </WidgetHostRegistryContext.Provider>
  );
}

/**
 * Registers `el` under `widgetId` for the provider's lifetime, tracking
 * the last-registered element by ref to avoid redundant re-registrations
 * on every render. When the id changes, the previous id is unregistered
 * before the new one is registered, so rename flows stay consistent.
 */
export function useRegisterHost(widgetId: string, el: HTMLElement | null): void {
  const registry = useContext(WidgetHostRegistryContext);
  const lastRef = useRef<{ id: string; el: HTMLElement | null } | null>(null);

  useEffect(() => {
    if (!registry) return;
    const last = lastRef.current;
    // Same id + same element → nothing changed since the last mount pass.
    if (last && last.id === widgetId && last.el === el) {
      return;
    }
    // Different widgetId? Drop the prior registration before remounting.
    if (last && last.id !== widgetId) {
      registry.unregister(last.id);
    }
    if (el) {
      registry.register(widgetId, el);
    } else {
      registry.unregister(widgetId);
    }
    lastRef.current = { id: widgetId, el };

    return () => {
      // On unmount (or before the next effect runs), drop whatever id this
      // hook last registered. Storing the id on lastRef keeps the teardown
      // correct even if `widgetId` changed mid-flight.
      const stored = lastRef.current;
      if (stored) {
        registry.unregister(stored.id);
        lastRef.current = null;
      }
    };
  }, [registry, widgetId, el]);
}

/**
 * Returns the active registry, or null when no `<WidgetHostRegistryProvider>`
 * is mounted (builder Design mode, isolated tests). Consumers should
 * treat null as "no-op" — CustomTrigger's runtime does.
 */
export function useWidgetHostRegistry(): WidgetHostRegistry | null {
  return useContext(WidgetHostRegistryContext);
}
