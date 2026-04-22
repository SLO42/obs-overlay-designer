import { describe, expect, it } from "vitest";
import type { Widget, WidgetKind } from "@obs/core";
import { DEFAULT_CANVAS, createEditorStore } from "../useEditorStore";

function makeWidget(kind: WidgetKind = "text"): Widget {
  return {
    id: Math.random().toString(36).slice(2, 12),
    kind,
    name: "test",
    transform: { x: 10, y: 10, w: 100, h: 100, rotation: 0, zIndex: 0 },
    props: { initial: true },
    triggers: [],
    effects: [],
  };
}

const noopPersist = () => Promise.resolve();

describe("useEditorStore", () => {
  it("newProject() seeds a valid Project with a 1920x1080 canvas and empty widgets", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    store.getState().newProject();
    const { project } = store.getState();

    expect(project.canvas).toEqual(DEFAULT_CANVAS);
    expect(project.widgets).toEqual([]);
    expect(project.meta.version).toBe(1);
    expect(project.meta.id).toHaveLength(21);
    expect(typeof project.meta.createdAt).toBe("number");
    expect(project.meta.createdAt).toBe(project.meta.updatedAt);
    expect(store.getState().selection).toEqual([]);
    expect(store.getState().history.past).toEqual([]);
    expect(store.getState().history.future).toEqual([]);
  });

  it("addWidget puts the widget at the end of the array using the injected defaults", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    const firstId = store.getState().addWidget("text")!;
    const secondId = store.getState().addWidget("image")!;

    const ids = store.getState().project.widgets.map((w) => w.id);
    expect(ids[ids.length - 1]).toBe(secondId);
    expect(ids[ids.length - 2]).toBe(firstId);

    // The injected factory's defaults flow through.
    const second = store.getState().project.widgets.find((w) => w.id === secondId)!;
    expect(second.kind).toBe("image");
    expect(second.props).toEqual({ initial: true });
  });

  it("addWidget honours preset overrides without letting preset.id collide", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    const newId = store.getState().addWidget("text", {
      name: "My Widget",
      transform: { x: 999 } as never,
      props: { extra: true },
    })!;
    const widget = store.getState().project.widgets.find((w) => w.id === newId)!;
    expect(widget.name).toBe("My Widget");
    expect(widget.transform.x).toBe(999);
    // other transform fields from the defaults are preserved
    expect(widget.transform.w).toBe(100);
    expect(widget.props).toEqual({ initial: true, extra: true });
  });

  it("removeWidgets removes the given ids and clears selection for those ids", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    const a = store.getState().addWidget("text")!;
    const b = store.getState().addWidget("text")!;
    const c = store.getState().addWidget("text")!;

    store.getState().setSelection([a, b, c]);
    store.getState().removeWidgets([a, c]);

    const remaining = store.getState().project.widgets.map((w) => w.id);
    expect(remaining).toEqual([b]);
    expect(store.getState().selection).toEqual([b]);
  });

  it("reorderWidgets with a non-permutation throws", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    const a = store.getState().addWidget("text")!;
    store.getState().addWidget("text");

    // Missing an id
    expect(() => store.getState().reorderWidgets([a])).toThrow();
    // Extra id
    expect(() => store.getState().reorderWidgets([a, "ghost", "also-ghost"])).toThrow();
    // Dup (not a permutation — same length but duplicate entries)
    expect(() => store.getState().reorderWidgets([a, a])).toThrow();
  });

  it("reorderWidgets with a valid permutation reorders", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    const a = store.getState().addWidget("text")!;
    const b = store.getState().addWidget("text")!;
    const c = store.getState().addWidget("text")!;

    store.getState().reorderWidgets([c, a, b]);
    expect(store.getState().project.widgets.map((w) => w.id)).toEqual([c, a, b]);
  });

  it("duplicateWidgets produces new ids and offsets positions by +20/+20", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    const a = store.getState().addWidget("text")!;
    const original = store.getState().project.widgets.find((w) => w.id === a)!;

    const [dupId] = store.getState().duplicateWidgets([a]);
    expect(dupId).toBeDefined();
    expect(dupId).not.toBe(a);

    const dup = store.getState().project.widgets.find((w) => w.id === dupId)!;
    expect(dup.transform.x).toBe(original.transform.x + 20);
    expect(dup.transform.y).toBe(original.transform.y + 20);
    expect(dup.kind).toBe(original.kind);
    expect(dup.name).toBe(`${original.name} copy`);
  });

  it("undo() after addWidget removes the widget", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    const before = store.getState().project.widgets.length;
    store.getState().addWidget("text");
    expect(store.getState().project.widgets.length).toBe(before + 1);

    store.getState().undo();
    expect(store.getState().project.widgets.length).toBe(before);
  });

  it("updateTransform shallow-merges transform fields", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    const a = store.getState().addWidget("text")!;
    store.getState().updateTransform(a, { x: 500, rotation: 45 });
    const w = store.getState().project.widgets.find((widget) => widget.id === a)!;
    expect(w.transform.x).toBe(500);
    expect(w.transform.rotation).toBe(45);
    // unchanged
    expect(w.transform.w).toBe(100);
  });

  it("updateProps merges one level deep", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    const a = store.getState().addWidget("text")!;
    store.getState().updateProps(a, { extra: 42 });
    const w = store.getState().project.widgets.find((widget) => widget.id === a)!;
    expect(w.props).toEqual({ initial: true, extra: 42 });
  });

  it("toggleHidden / toggleLocked flip on the stack", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    const a = store.getState().addWidget("text")!;
    const stackBefore = store.getState().history.past.length;

    store.getState().toggleHidden(a);
    expect(store.getState().project.widgets.find((w) => w.id === a)!.hidden).toBe(true);
    store.getState().toggleLocked(a);
    expect(store.getState().project.widgets.find((w) => w.id === a)!.locked).toBe(true);

    // Both flips recorded as history entries.
    expect(store.getState().history.past.length).toBe(stackBefore + 2);
  });

  it("selection helpers de-duplicate and clamp", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    store.getState().setSelection(["a", "b"]);
    store.getState().addToSelection("a"); // already present → no change
    expect(store.getState().selection).toEqual(["a", "b"]);

    store.getState().addToSelection("c");
    expect(store.getState().selection).toEqual(["a", "b", "c"]);

    store.getState().removeFromSelection("b");
    expect(store.getState().selection).toEqual(["a", "c"]);

    store.getState().clearSelection();
    expect(store.getState().selection).toEqual([]);
  });

  it("loadProject replaces state and clears history", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    store.getState().addWidget("text");
    store.getState().addWidget("text");
    expect(store.getState().history.past.length).toBeGreaterThan(0);

    const fresh = {
      meta: { id: "fresh-id", name: "Fresh", createdAt: 1, updatedAt: 1, version: 1 as const },
      canvas: { width: 800, height: 600 },
      widgets: [],
    };
    store.getState().loadProject(fresh);
    expect(store.getState().project).toBe(fresh);
    expect(store.getState().history.past).toEqual([]);
    expect(store.getState().history.future).toEqual([]);
    expect(store.getState().selection).toEqual([]);
  });

  it("triggers and effects can be added/updated/removed", () => {
    const store = createEditorStore({ createDefaults: makeWidget, persist: noopPersist });
    const widgetId = store.getState().addWidget("text")!;
    const trigger = {
      id: "trig-1",
      match: { type: "chat.command" as const, command: "!hype" },
      effects: [],
      enabled: true,
    };
    store.getState().addTrigger(widgetId, trigger);
    expect(store.getState().project.widgets.find((w) => w.id === widgetId)!.triggers).toHaveLength(
      1,
    );

    store.getState().updateTrigger(widgetId, trigger.id, { enabled: false });
    expect(
      store.getState().project.widgets.find((w) => w.id === widgetId)!.triggers[0]!.enabled,
    ).toBe(false);

    store.getState().removeTrigger(widgetId, trigger.id);
    expect(store.getState().project.widgets.find((w) => w.id === widgetId)!.triggers).toHaveLength(
      0,
    );

    const effect = { id: "fx-1", type: "flash" as const, color: "#fff", durationMs: 200 };
    store.getState().addEffect(widgetId, effect);
    store.getState().updateEffect(widgetId, effect.id, { durationMs: 500 } as never);
    expect(
      store.getState().project.widgets.find((w) => w.id === widgetId)!.effects[0]!.durationMs,
    ).toBe(500);

    store.getState().removeEffect(widgetId, effect.id);
    expect(store.getState().project.widgets.find((w) => w.id === widgetId)!.effects).toHaveLength(
      0,
    );
  });
});
