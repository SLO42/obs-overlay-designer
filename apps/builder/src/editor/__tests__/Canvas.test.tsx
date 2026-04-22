import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useEditorStore, createBlankProject } from "../../store";
import { KeyboardShortcuts } from "../KeyboardShortcuts";

/**
 * The KeyboardShortcuts component owns Delete / Ctrl+Z / nudge shortcuts,
 * and writes directly to the store. We mount it in isolation so we can
 * dispatch keyboard events against `window` and observe the store state.
 */
describe("Canvas shortcuts (KeyboardShortcuts)", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createBlankProject("test"),
      selection: [],
      history: { past: [], future: [] },
      status: "idle",
      lastSavedAt: undefined,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("pressing Delete with a selected widget calls removeWidgets", () => {
    render(<KeyboardShortcuts />);
    const store = useEditorStore.getState();
    const id = store.addWidget("text")!;
    store.setSelection([id]);

    fireEvent.keyDown(window, { key: "Delete" });

    const { project, selection } = useEditorStore.getState();
    expect(project.widgets.find((w) => w.id === id)).toBeUndefined();
    expect(selection).toEqual([]);
  });

  it("ArrowRight nudges transform.x by 1; shift+ArrowRight by 10", () => {
    render(<KeyboardShortcuts />);
    const id = useEditorStore.getState().addWidget("text")!;
    const startX = useEditorStore.getState().project.widgets.find((w) => w.id === id)!.transform.x;
    useEditorStore.getState().setSelection([id]);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(useEditorStore.getState().project.widgets.find((w) => w.id === id)!.transform.x).toBe(
      startX + 1,
    );

    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
    expect(useEditorStore.getState().project.widgets.find((w) => w.id === id)!.transform.x).toBe(
      startX + 11,
    );
  });

  it("Delete inside an Input does NOT trigger widget deletion", () => {
    render(
      <>
        <input data-testid="text-field" />
        <KeyboardShortcuts />
      </>,
    );
    const store = useEditorStore.getState();
    const id = store.addWidget("text")!;
    store.setSelection([id]);

    const field = document.querySelector('[data-testid="text-field"]') as HTMLInputElement;
    field.focus();
    fireEvent.keyDown(field, { key: "Delete" });
    expect(useEditorStore.getState().project.widgets.find((w) => w.id === id)).toBeDefined();
  });

  it("Ctrl+Z undoes and Ctrl+Shift+Z redoes", () => {
    render(<KeyboardShortcuts />);
    const store = useEditorStore.getState();
    const id = store.addWidget("text")!;
    expect(useEditorStore.getState().project.widgets.length).toBe(1);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(useEditorStore.getState().project.widgets.length).toBe(0);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(useEditorStore.getState().project.widgets.length).toBe(1);
    expect(useEditorStore.getState().project.widgets[0]!.id).toBe(id);
  });

  it("Ctrl+D duplicates the current selection and updates selection to new ids", () => {
    render(<KeyboardShortcuts />);
    const store = useEditorStore.getState();
    const id = store.addWidget("text")!;
    store.setSelection([id]);

    fireEvent.keyDown(window, { key: "d", ctrlKey: true });
    const state = useEditorStore.getState();
    expect(state.project.widgets.length).toBe(2);
    expect(state.selection.length).toBe(1);
    expect(state.selection[0]).not.toBe(id);
  });
});
