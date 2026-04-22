import { createContext, useContext, type ReactNode } from "react";
import type { Widget } from "@obs/core";

/**
 * Minimal view of the canvas's widget list the CustomTrigger Inspector
 * needs to build its Targets multi-select. The builder provides this via
 * `CanvasWidgetsProvider` — a Zustand-backed adapter that drops in the
 * live `project.widgets` slice and (optionally) flags the self-id so the
 * Inspector can exclude it.
 *
 * Default is `null`, which means "no canvas visible yet" — the Inspector
 * falls back to a short empty-state hint in that case so it still renders
 * in isolated tests that skip the builder harness.
 */
export interface CanvasWidgetsView {
  /** The ordered list of widgets currently on the canvas. */
  widgets: Array<Pick<Widget, "id" | "kind" | "name">>;
}

export const CanvasWidgetsContext = createContext<CanvasWidgetsView | null>(null);

export interface CanvasWidgetsProviderProps {
  widgets: Array<Pick<Widget, "id" | "kind" | "name">>;
  children: ReactNode;
}

/**
 * Wraps children with a snapshot of the canvas's widgets. The builder's
 * Inspector wraps the `<CustomInspector>` render in this provider so the
 * CustomTrigger Inspector can build its Targets multi-select without
 * importing the app-local store (packages can't reach into apps).
 */
export function CanvasWidgetsProvider({ widgets, children }: CanvasWidgetsProviderProps) {
  return (
    <CanvasWidgetsContext.Provider value={{ widgets }}>{children}</CanvasWidgetsContext.Provider>
  );
}

/**
 * Read the canvas widget list, or `null` when no provider is mounted
 * (isolated component tests, storybook scratch pages).
 */
export function useCanvasWidgets(): CanvasWidgetsView | null {
  return useContext(CanvasWidgetsContext);
}
