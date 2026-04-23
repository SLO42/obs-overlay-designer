import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  id as makeId,
  type CanvasSize,
  type Effect,
  type Project,
  type Transform,
  type Trigger,
  type Widget,
  type WidgetKind,
} from "@obs/core";
import { createWidget as createWidgetFromRegistry } from "@obs/widgets";
import {
  applyAndRecord,
  initialHistory,
  redo as historyRedo,
  undo as historyUndo,
  type HistoryState,
} from "./history";
import { saveProject } from "./persistence";

export type Status = "idle" | "saving" | "saved" | "error";

export interface EditorState {
  project: Project;
  /** widget ids */
  selection: string[];
  history: HistoryState;
  status: Status;
  lastSavedAt?: number;

  // project-level
  setProjectName: (name: string) => void;
  setCanvas: (size: CanvasSize) => void;
  newProject: () => void;
  loadProject: (project: Project) => void;
  /** Task 22: stash the streamer slug returned by ensure-streamer. */
  setStreamteamSlug: (slug: string) => void;

  // widgets
  addWidget: (kind: WidgetKind, preset?: Partial<Widget>) => string | null;
  removeWidgets: (ids: string[]) => void;
  duplicateWidgets: (ids: string[]) => string[];
  updateWidget: (id: string, patch: Partial<Widget>) => void;
  updateTransform: (id: string, patch: Partial<Transform>) => void;
  updateProps: (id: string, patch: Record<string, unknown>) => void;
  reorderWidgets: (ids: string[]) => void;

  // selection (never on undo stack)
  setSelection: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  clearSelection: () => void;

  // flags (do go on the stack)
  toggleHidden: (id: string) => void;
  toggleLocked: (id: string) => void;

  // triggers
  addTrigger: (widgetId: string, trigger: Trigger) => void;
  removeTrigger: (widgetId: string, triggerId: string) => void;
  updateTrigger: (widgetId: string, triggerId: string, patch: Partial<Trigger>) => void;

  // effects
  addEffect: (widgetId: string, effect: Effect) => void;
  removeEffect: (widgetId: string, effectId: string) => void;
  updateEffect: (widgetId: string, effectId: string, patch: Partial<Effect>) => void;

  // history
  undo: () => void;
  redo: () => void;

  // internal hooks for persistence status transitions
  _setStatus: (status: Status, lastSavedAt?: number) => void;
}

export const DEFAULT_CANVAS: CanvasSize = { width: 1920, height: 1080 };

/**
 * Builds a fresh, empty Project. Kept here (not imported) so the store has
 * no runtime dep on `@obs/core` beyond the `id()` helper. Callers can pass
 * an override via `loadProject`.
 */
export function createBlankProject(name = "Untitled Project"): Project {
  const now = Date.now();
  return {
    meta: {
      id: makeId(),
      name,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    canvas: { ...DEFAULT_CANVAS },
    widgets: [],
  };
}

/**
 * Minimal default widget used when no `createDefaults` callback is injected
 * at store-init time. Task 4 will swap this out for the widgets registry.
 */
function defaultWidget(kind: WidgetKind): Widget {
  return {
    id: makeId(),
    kind,
    name: kind,
    transform: {
      x: 0,
      y: 0,
      w: 320,
      h: 180,
      rotation: 0,
      zIndex: 0,
    },
    props: {},
    triggers: [],
    effects: [],
  };
}

export interface EditorStoreOptions {
  /** Custom factory used by `addWidget`. Task 4 wires this to @obs/widgets. */
  createDefaults?: (kind: WidgetKind) => Widget;
  /** Initial project; defaults to an empty blank. */
  initialProject?: Project;
  /** Persistence adapter; defaults to the shared debounced IndexedDB saver. */
  persist?: (project: Project) => Promise<void>;
  /** If true, subscribe the store's project to the persistence adapter. */
  autoPersist?: boolean;
}

function isPermutation(current: string[], next: string[]): boolean {
  if (current.length !== next.length) return false;
  const a = new Set(current);
  for (const val of next) {
    if (!a.has(val)) return false;
  }
  const b = new Set(next);
  return b.size === next.length;
}

export function createEditorStore(options: EditorStoreOptions = {}) {
  const createDefaults = options.createDefaults ?? defaultWidget;
  const persist = options.persist ?? saveProject;
  const autoPersist = options.autoPersist ?? true;

  const store = create<EditorState>()(
    subscribeWithSelector((set, get) => {
      /**
       * Every mutation routes through this helper so immer can record a
       * single patch group per action. Selection changes bypass it (they
       * use `set` directly) so they never land on the undo stack.
       */
      const mutate = (recipe: (draft: Project) => void) => {
        const { project, history } = get();
        const result = applyAndRecord(project, history, recipe);
        if (!result.changed) return;
        set({ project: result.next, history: result.history });
      };

      return {
        project: options.initialProject ?? createBlankProject(),
        selection: [],
        history: initialHistory(),
        status: "idle",

        setProjectName: (name) =>
          mutate((draft) => {
            draft.meta.name = name;
            draft.meta.updatedAt = Date.now();
          }),

        setCanvas: (size) =>
          mutate((draft) => {
            draft.canvas = { ...size };
            draft.meta.updatedAt = Date.now();
          }),

        newProject: () => {
          set({
            project: createBlankProject(),
            selection: [],
            history: initialHistory(),
            status: "idle",
            lastSavedAt: undefined,
          });
        },

        loadProject: (project) => {
          set({
            project,
            selection: [],
            history: initialHistory(),
            status: "idle",
            lastSavedAt: undefined,
          });
        },

        setStreamteamSlug: (slug) =>
          mutate((draft) => {
            draft.streamteam = { ...(draft.streamteam ?? {}), slug };
            draft.meta.updatedAt = Date.now();
          }),

        addWidget: (kind, preset) => {
          const base = createDefaults(kind);
          const widget: Widget = {
            ...base,
            ...preset,
            // Always mint a fresh id for the new instance; callers shouldn't
            // be able to smuggle in a dup id via preset.
            id: preset?.id ?? makeId(),
            transform: { ...base.transform, ...(preset?.transform ?? {}) },
            props: { ...(base.props as Record<string, unknown>), ...(preset?.props ?? {}) },
            triggers: preset?.triggers ?? base.triggers,
            effects: preset?.effects ?? base.effects,
          } as Widget;

          let newId: string | null = null;
          mutate((draft) => {
            draft.widgets.push(widget);
            newId = widget.id;
            draft.meta.updatedAt = Date.now();
          });
          return newId;
        },

        removeWidgets: (ids) => {
          if (ids.length === 0) return;
          const idSet = new Set(ids);
          mutate((draft) => {
            draft.widgets = draft.widgets.filter((w) => !idSet.has(w.id));
            draft.meta.updatedAt = Date.now();
          });
          // Clear the removed ids from selection (selection is not on the
          // history stack; do it via a plain set).
          const sel = get().selection.filter((sId) => !idSet.has(sId));
          if (sel.length !== get().selection.length) {
            set({ selection: sel });
          }
        },

        duplicateWidgets: (ids) => {
          if (ids.length === 0) return [];
          const newIds: string[] = [];
          mutate((draft) => {
            const toDupe = draft.widgets.filter((w) => ids.includes(w.id));
            for (const source of toDupe) {
              const copy: Widget = {
                ...source,
                id: makeId(),
                name: `${source.name} copy`,
                transform: {
                  ...source.transform,
                  x: source.transform.x + 20,
                  y: source.transform.y + 20,
                },
                triggers: source.triggers.map((t) => ({ ...t, id: makeId() })),
                effects: source.effects.map((e) => ({ ...e, id: makeId() })),
              };
              draft.widgets.push(copy);
              newIds.push(copy.id);
            }
            draft.meta.updatedAt = Date.now();
          });
          return newIds;
        },

        updateWidget: (id, patch) =>
          mutate((draft) => {
            const w = draft.widgets.find((widget) => widget.id === id);
            if (!w) return;
            const { transform, props, ...rest } = patch;
            Object.assign(w, rest);
            if (transform) {
              Object.assign(w.transform, transform);
            }
            if (props) {
              Object.assign(w.props as Record<string, unknown>, props);
            }
            draft.meta.updatedAt = Date.now();
          }),

        updateTransform: (id, patch) =>
          mutate((draft) => {
            const w = draft.widgets.find((widget) => widget.id === id);
            if (!w) return;
            Object.assign(w.transform, patch);
            draft.meta.updatedAt = Date.now();
          }),

        updateProps: (id, patch) =>
          mutate((draft) => {
            const w = draft.widgets.find((widget) => widget.id === id);
            if (!w) return;
            Object.assign(w.props as Record<string, unknown>, patch);
            draft.meta.updatedAt = Date.now();
          }),

        reorderWidgets: (ids) => {
          const currentIds = get().project.widgets.map((w) => w.id);
          if (!isPermutation(currentIds, ids)) {
            throw new Error("reorderWidgets requires a full permutation of existing widget ids");
          }
          mutate((draft) => {
            const byId = new Map(draft.widgets.map((w) => [w.id, w]));
            draft.widgets = ids.map((id) => byId.get(id)!);
            draft.meta.updatedAt = Date.now();
          });
        },

        setSelection: (ids) => set({ selection: [...ids] }),
        addToSelection: (id) => {
          const sel = get().selection;
          if (sel.includes(id)) return;
          set({ selection: [...sel, id] });
        },
        removeFromSelection: (id) => {
          const sel = get().selection;
          if (!sel.includes(id)) return;
          set({ selection: sel.filter((s) => s !== id) });
        },
        clearSelection: () => {
          if (get().selection.length === 0) return;
          set({ selection: [] });
        },

        toggleHidden: (id) =>
          mutate((draft) => {
            const w = draft.widgets.find((widget) => widget.id === id);
            if (!w) return;
            w.hidden = !w.hidden;
            draft.meta.updatedAt = Date.now();
          }),

        toggleLocked: (id) =>
          mutate((draft) => {
            const w = draft.widgets.find((widget) => widget.id === id);
            if (!w) return;
            w.locked = !w.locked;
            draft.meta.updatedAt = Date.now();
          }),

        addTrigger: (widgetId, trigger) =>
          mutate((draft) => {
            const w = draft.widgets.find((widget) => widget.id === widgetId);
            if (!w) return;
            w.triggers.push(trigger);
            draft.meta.updatedAt = Date.now();
          }),

        removeTrigger: (widgetId, triggerId) =>
          mutate((draft) => {
            const w = draft.widgets.find((widget) => widget.id === widgetId);
            if (!w) return;
            w.triggers = w.triggers.filter((t) => t.id !== triggerId);
            draft.meta.updatedAt = Date.now();
          }),

        updateTrigger: (widgetId, triggerId, patch) =>
          mutate((draft) => {
            const w = draft.widgets.find((widget) => widget.id === widgetId);
            if (!w) return;
            const t = w.triggers.find((trig) => trig.id === triggerId);
            if (!t) return;
            Object.assign(t, patch);
            draft.meta.updatedAt = Date.now();
          }),

        addEffect: (widgetId, effect) =>
          mutate((draft) => {
            const w = draft.widgets.find((widget) => widget.id === widgetId);
            if (!w) return;
            w.effects.push(effect);
            draft.meta.updatedAt = Date.now();
          }),

        removeEffect: (widgetId, effectId) =>
          mutate((draft) => {
            const w = draft.widgets.find((widget) => widget.id === widgetId);
            if (!w) return;
            w.effects = w.effects.filter((e) => e.id !== effectId);
            draft.meta.updatedAt = Date.now();
          }),

        updateEffect: (widgetId, effectId, patch) =>
          mutate((draft) => {
            const w = draft.widgets.find((widget) => widget.id === widgetId);
            if (!w) return;
            const idx = w.effects.findIndex((e) => e.id === effectId);
            if (idx === -1) return;
            // Preserve discriminant; shallow-merge the rest. We cast because
            // Partial<Effect> across a union is not auto-narrowed.
            w.effects[idx] = { ...w.effects[idx]!, ...patch } as Effect;
            draft.meta.updatedAt = Date.now();
          }),

        undo: () => {
          const { project, history } = get();
          const result = historyUndo(project, history);
          if (!result.changed) return;
          set({ project: result.next, history: result.history });
        },

        redo: () => {
          const { project, history } = get();
          const result = historyRedo(project, history);
          if (!result.changed) return;
          set({ project: result.next, history: result.history });
        },

        _setStatus: (status, lastSavedAt) =>
          set((prev) => ({
            status,
            lastSavedAt: lastSavedAt ?? prev.lastSavedAt,
          })),
      };
    }),
  );

  if (autoPersist) {
    // Kick a save whenever the project reference changes. `subscribeWithSelector`
    // calls the listener only when the selector value shallow-differs, which
    // is exactly what we get from immer's structural sharing.
    store.subscribe(
      (state) => state.project,
      (project) => {
        store.getState()._setStatus("saving");
        persist(project).then(
          () => store.getState()._setStatus("saved", Date.now()),
          () => store.getState()._setStatus("error"),
        );
      },
    );
  }

  return store;
}

export const useEditorStore = createEditorStore({
  // The widgets registry is the source of truth for per-kind defaults.
  // Tests that want to stub this out construct their own store via
  // `createEditorStore({ createDefaults: ... })`.
  createDefaults: (kind) => createWidgetFromRegistry(kind),
});
