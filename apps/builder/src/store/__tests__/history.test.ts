import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Widget, WidgetKind } from "@obs/core";
import { HISTORY_LIMIT } from "../history";
import { createEditorStore } from "../useEditorStore";

function makeWidget(kind: WidgetKind = "text"): Widget {
  return {
    id: Math.random().toString(36).slice(2, 12),
    kind,
    name: "test",
    transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0, zIndex: 0 },
    props: {},
    triggers: [],
    effects: [],
  };
}

const noopPersist = () => Promise.resolve();

describe("editor history (undo/redo reducer)", () => {
  beforeEach(() => {
    // Every test instantiates a fresh store so state doesn't leak.
  });

  it("add → undo → state goes back; redo → state forward", () => {
    const store = createEditorStore({
      createDefaults: makeWidget,
      persist: noopPersist,
    });
    const api = store.getState();

    const beforeCount = api.project.widgets.length;
    api.addWidget("text");
    expect(store.getState().project.widgets.length).toBe(beforeCount + 1);

    store.getState().undo();
    expect(store.getState().project.widgets.length).toBe(beforeCount);

    store.getState().redo();
    expect(store.getState().project.widgets.length).toBe(beforeCount + 1);
  });

  it("keeps history at 100 past entries after 101 mutations; oldest is dropped", () => {
    const store = createEditorStore({
      createDefaults: makeWidget,
      persist: noopPersist,
    });
    // 101 mutations: 101 addWidget calls
    for (let i = 0; i < HISTORY_LIMIT + 1; i++) {
      store.getState().addWidget("text");
    }
    expect(store.getState().history.past.length).toBe(HISTORY_LIMIT);

    // Proof the oldest frame was dropped: undoing 100 times should leave at
    // least one widget on the canvas (the one from the dropped frame).
    const widgetCountAfterAllAdds = store.getState().project.widgets.length;
    expect(widgetCountAfterAllAdds).toBe(HISTORY_LIMIT + 1);
    for (let i = 0; i < HISTORY_LIMIT; i++) {
      store.getState().undo();
    }
    expect(store.getState().project.widgets.length).toBe(1);
  });

  it("setSelection does not add a history entry", () => {
    const store = createEditorStore({
      createDefaults: makeWidget,
      persist: noopPersist,
    });
    const id = store.getState().addWidget("text")!;
    const sizeBefore = store.getState().history.past.length;

    store.getState().setSelection([id]);
    store.getState().addToSelection("other");
    store.getState().removeFromSelection("other");
    store.getState().clearSelection();

    expect(store.getState().history.past.length).toBe(sizeBefore);
    expect(store.getState().selection).toEqual([]);
  });

  it("updateTransform on a non-existent id is a no-op and does not grow history", () => {
    const store = createEditorStore({
      createDefaults: makeWidget,
      persist: noopPersist,
    });
    const sizeBefore = store.getState().history.past.length;
    const projectBefore = store.getState().project;

    store.getState().updateTransform("does-not-exist", { x: 999 });

    expect(store.getState().history.past.length).toBe(sizeBefore);
    // Reference equality: immer's structural sharing + our `changed` guard
    // means no-ops don't even swap the project reference.
    expect(store.getState().project).toBe(projectBefore);
  });

  it("undo then new mutation clears the redo stack", () => {
    const store = createEditorStore({
      createDefaults: makeWidget,
      persist: noopPersist,
    });
    store.getState().addWidget("text");
    store.getState().addWidget("text");
    store.getState().undo();
    expect(store.getState().history.future.length).toBe(1);

    store.getState().addWidget("text");
    expect(store.getState().history.future.length).toBe(0);
  });

  it("undo on empty stack is a no-op (clamps)", () => {
    const store = createEditorStore({
      createDefaults: makeWidget,
      persist: noopPersist,
    });
    const projectBefore = store.getState().project;
    store.getState().undo();
    store.getState().redo();
    expect(store.getState().project).toBe(projectBefore);
  });

  it("persist not required for history behavior (persist mocked)", () => {
    const persist = vi.fn(noopPersist);
    const store = createEditorStore({
      createDefaults: makeWidget,
      persist,
      autoPersist: false,
    });
    store.getState().addWidget("text");
    expect(persist).not.toHaveBeenCalled();
  });
});
