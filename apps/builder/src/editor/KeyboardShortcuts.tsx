import { useEffect } from "react";
import { useEditorStore } from "../store";
import { isEditableTarget, isModKey } from "./shortcuts";

/**
 * Global keyboard shortcut host. Mounted once at the root. Shortcuts shipped:
 *  - Ctrl/Cmd+Z → undo
 *  - Ctrl/Cmd+Shift+Z / Ctrl+Y → redo
 *  - Ctrl/Cmd+D → duplicate selection
 *  - Delete / Backspace → remove selection (ignored inside inputs)
 *  - Arrow keys → nudge selected widgets by 1px (shift = 10px)
 *
 * All shortcuts early-out when focus is inside an editable control so the
 * user doesn't lose widgets while typing into the project-name Input.
 */
export function KeyboardShortcuts() {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const removeWidgets = useEditorStore((s) => s.removeWidgets);
  const duplicateWidgets = useEditorStore((s) => s.duplicateWidgets);
  const updateTransform = useEditorStore((s) => s.updateTransform);
  const setSelection = useEditorStore((s) => s.setSelection);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const editable = isEditableTarget(event.target);
      const mod = isModKey(event);

      // Undo / Redo — allowed from anywhere (macOS system convention).
      if (mod && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && !event.shiftKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }

      // Duplicate / Delete / nudge only outside editable targets.
      if (editable) return;

      const { selection } = useEditorStore.getState();

      if (mod && !event.shiftKey && event.key.toLowerCase() === "d") {
        if (selection.length === 0) return;
        event.preventDefault();
        const newIds = duplicateWidgets(selection);
        if (newIds.length > 0) setSelection(newIds);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selection.length === 0) return;
        event.preventDefault();
        removeWidgets(selection);
        return;
      }

      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
      ) {
        if (selection.length === 0) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        const { project } = useEditorStore.getState();
        for (const id of selection) {
          const w = project.widgets.find((wd) => wd.id === id);
          if (!w || w.locked) continue;
          updateTransform(id, { x: w.transform.x + dx, y: w.transform.y + dy });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, removeWidgets, duplicateWidgets, updateTransform, setSelection]);

  return null;
}
