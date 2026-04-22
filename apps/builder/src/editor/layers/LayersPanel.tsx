import { useState, type DragEvent } from "react";
import { useEditorStore } from "../../store";
import { LayerRow } from "./LayerRow";
import styles from "./Layers.module.css";

/**
 * Layers tree. Shows every widget in `project.widgets` in *reverse* array
 * order — top of the visual list = last in the array = visually front-most
 * on the canvas. That matches common editor conventions (Photoshop, Figma).
 *
 * Drag-and-drop reordering is implemented with native HTML5 DnD to keep
 * the dep surface small; drops commit a single `reorderWidgets` call with
 * the new full permutation.
 */
export function LayersPanel() {
  const widgets = useEditorStore((s) => s.project.widgets);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const addToSelection = useEditorStore((s) => s.addToSelection);
  const removeFromSelection = useEditorStore((s) => s.removeFromSelection);
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const toggleHidden = useEditorStore((s) => s.toggleHidden);
  const toggleLocked = useEditorStore((s) => s.toggleLocked);
  const reorderWidgets = useEditorStore((s) => s.reorderWidgets);

  // Dragged widget id (lives for the duration of a DnD cycle) and which
  // row the pointer is currently over (for the drop-target style hint).
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const displayed = [...widgets].reverse();

  const handleSelect = (id: string, event: React.MouseEvent) => {
    if (event.shiftKey) {
      if (selection.includes(id)) removeFromSelection(id);
      else addToSelection(id);
    } else {
      setSelection([id]);
    }
  };

  const handleDragStart = (id: string, event: DragEvent<HTMLDivElement>) => {
    setDragId(id);
    event.dataTransfer.effectAllowed = "move";
    // Firefox requires some data for the drag to begin.
    event.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (id: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  };

  const handleDragLeave = (id: string) => {
    if (overId === id) setOverId(null);
  };

  const handleDrop = (targetId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceId = dragId ?? event.dataTransfer.getData("text/plain");
    setDragId(null);
    setOverId(null);
    if (!sourceId || sourceId === targetId) return;

    // The panel renders in reverse-array order; to keep "drop above row X"
    // intuitive from the user's point of view, we compute the reorder on
    // the displayed (reversed) list and flip it back.
    const reversedIds = displayed.map((w) => w.id);
    const srcIdx = reversedIds.indexOf(sourceId);
    const tgtIdx = reversedIds.indexOf(targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;
    const next = [...reversedIds];
    next.splice(srcIdx, 1);
    // Drop above the target → insert at target index (after any adjust
    // for the removed source). If srcIdx < tgtIdx, the target shifted up
    // by one, so we insert at tgtIdx; otherwise at tgtIdx.
    const insertAt = srcIdx < tgtIdx ? tgtIdx : tgtIdx;
    next.splice(insertAt, 0, sourceId);
    const forward = [...next].reverse();
    reorderWidgets(forward);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setOverId(null);
  };

  if (widgets.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>No widgets yet. Add one from the Widgets tab.</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.list} data-testid="layers-list">
        {displayed.map((widget) => (
          <LayerRow
            key={widget.id}
            widget={widget}
            selected={selection.includes(widget.id)}
            isDropTarget={overId === widget.id}
            onSelect={(event) => handleSelect(widget.id, event)}
            onRename={(name) => updateWidget(widget.id, { name })}
            onToggleHidden={() => toggleHidden(widget.id)}
            onToggleLocked={() => toggleLocked(widget.id)}
            onDragStart={(event) => handleDragStart(widget.id, event)}
            onDragOver={(event) => handleDragOver(widget.id, event)}
            onDragLeave={() => handleDragLeave(widget.id)}
            onDrop={(event) => handleDrop(widget.id, event)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
    </div>
  );
}
