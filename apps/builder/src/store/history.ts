import { applyPatches, enablePatches, produceWithPatches, type Patch } from "immer";

// Enable patch tracking up-front — immer gates `produceWithPatches` behind it.
enablePatches();

export const HISTORY_LIMIT = 100;

export interface HistoryState {
  past: Array<{ forward: Patch[]; inverse: Patch[] }>;
  future: Array<{ forward: Patch[]; inverse: Patch[] }>;
}

export function initialHistory(): HistoryState {
  return { past: [], future: [] };
}

export interface ApplyResult<T> {
  next: T;
  history: HistoryState;
  /** True if the mutation produced any patches (state actually changed). */
  changed: boolean;
}

/**
 * Runs an immer recipe, records the forward/inverse patch pair as a single
 * undo frame, clears the redo stack, and caps history at HISTORY_LIMIT.
 *
 * If the recipe produced zero patches (no-op), the history is returned
 * unchanged so non-mutating calls don't eat undo slots.
 */
export function applyAndRecord<T extends object>(
  state: T,
  history: HistoryState,
  recipe: (draft: T) => void,
): ApplyResult<T> {
  const [next, forward, inverse] = produceWithPatches(state, recipe);
  if (forward.length === 0) {
    return { next, history, changed: false };
  }

  const past = history.past.concat({ forward, inverse });
  // Cap history at HISTORY_LIMIT past entries; drop oldest.
  const trimmed = past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past;

  return {
    next,
    history: { past: trimmed, future: [] },
    changed: true,
  };
}

export interface UndoResult<T> {
  next: T;
  history: HistoryState;
  changed: boolean;
}

export function undo<T extends object>(state: T, history: HistoryState): UndoResult<T> {
  if (history.past.length === 0) {
    return { next: state, history, changed: false };
  }
  const frame = history.past[history.past.length - 1]!;
  const next = applyPatches(state, frame.inverse);
  return {
    next,
    history: {
      past: history.past.slice(0, -1),
      future: history.future.concat(frame),
    },
    changed: true,
  };
}

export function redo<T extends object>(state: T, history: HistoryState): UndoResult<T> {
  if (history.future.length === 0) {
    return { next: state, history, changed: false };
  }
  const frame = history.future[history.future.length - 1]!;
  const next = applyPatches(state, frame.forward);
  return {
    next,
    history: {
      past: history.past.concat(frame),
      future: history.future.slice(0, -1),
    },
    changed: true,
  };
}
