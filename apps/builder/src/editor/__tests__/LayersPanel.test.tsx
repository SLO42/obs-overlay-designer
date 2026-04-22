import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { useEditorStore, createBlankProject } from "../../store";
import { LayersPanel } from "../layers/LayersPanel";

/**
 * LayersPanel uses the singleton `useEditorStore` directly. Tests reset
 * the store state between cases so each test starts from a clean project.
 */
describe("LayersPanel", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createBlankProject("test"),
      selection: [],
      history: { past: [], future: [] },
      status: "idle",
      lastSavedAt: undefined,
    });
    const store = useEditorStore.getState();
    store.addWidget("text");
    store.addWidget("image");
    store.setSelection([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders widgets in reverse array order (top of list = last widget)", () => {
    render(<LayersPanel />);
    const list = screen.getByTestId("layers-list");
    const rows = Array.from(list.querySelectorAll("[data-widget-id]"));
    // Project was seeded with [text, image]; reversed list shows [image, text].
    const { project } = useEditorStore.getState();
    const firstRowId = rows[0]?.getAttribute("data-widget-id");
    const secondRowId = rows[1]?.getAttribute("data-widget-id");
    expect(firstRowId).toBe(project.widgets[1]!.id);
    expect(secondRowId).toBe(project.widgets[0]!.id);
  });

  it("clicking a row selects that widget in the store", () => {
    render(<LayersPanel />);
    const list = screen.getByTestId("layers-list");
    const rows = Array.from(list.querySelectorAll("[data-widget-id]")) as HTMLElement[];
    const firstRow = rows[0]!;
    const id = firstRow.getAttribute("data-widget-id")!;

    fireEvent.click(firstRow);
    expect(useEditorStore.getState().selection).toEqual([id]);
  });

  it("clicking the visibility icon toggles hidden", () => {
    render(<LayersPanel />);
    const { project } = useEditorStore.getState();
    const firstWidget = project.widgets[1]!; // displayed on top (reversed)
    const hideButton = screen.getAllByRole("button", { name: /hide widget/i })[0]!;
    fireEvent.click(hideButton);
    const updated = useEditorStore.getState().project.widgets.find((w) => w.id === firstWidget.id);
    expect(updated?.hidden).toBe(true);
  });
});
