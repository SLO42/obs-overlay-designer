import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Icon, type IconName } from "@obs/design-system";
import type { Widget } from "@obs/core";
import { getWidget } from "@obs/widgets";
import styles from "./Layers.module.css";

interface LayerRowProps {
  widget: Widget;
  selected: boolean;
  isDropTarget: boolean;
  onSelect: (event: React.MouseEvent) => void;
  onRename: (name: string) => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: (event: DragEvent<HTMLDivElement>) => void;
}

/**
 * Single layers-panel row. Shows:
 *  - widget-kind icon (from registry)
 *  - inline editable name (double-click or Enter to commit)
 *  - visibility toggle (Eye / EyeOff)
 *  - lock toggle (Lock / LockOpen)
 *  - drag handle (GripVertical)
 *
 * All mutations route through callbacks so the parent can stage a single
 * store update per drop.
 */
export function LayerRow({
  widget,
  selected,
  isDropTarget,
  onSelect,
  onRename,
  onToggleHidden,
  onToggleLocked,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: LayerRowProps) {
  const def = getWidget(widget.kind);
  const iconName = (def?.icon ?? "Square") as IconName;

  const [name, setName] = useState(widget.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(widget.name);
  }, [widget.name]);

  const commit = () => {
    if (name !== widget.name) onRename(name);
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      inputRef.current?.blur();
    } else if (event.key === "Escape") {
      setName(widget.name);
      inputRef.current?.blur();
    }
  };

  const rowClass = [styles.row, selected && styles.selected, isDropTarget && styles.dropTarget]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rowClass}
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      data-widget-id={widget.id}
    >
      <span className={styles.handle} aria-hidden="true">
        <Icon name="GripVertical" size={12} />
      </span>
      <span className={styles.rowIcon}>
        <Icon name={iconName} size={14} />
      </span>
      <input
        ref={inputRef}
        className={`${styles.name}${widget.hidden ? ` ${styles.hidden}` : ""}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={commit}
        onKeyDown={handleNameKeyDown}
        onClick={(event) => event.stopPropagation()}
        aria-label="Widget name"
      />
      <button
        type="button"
        className={`${styles.action}${widget.hidden ? "" : ` ${styles.on}`}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleHidden();
        }}
        aria-label={widget.hidden ? "Show widget" : "Hide widget"}
        title={widget.hidden ? "Show" : "Hide"}
      >
        <Icon name={widget.hidden ? "EyeOff" : "Eye"} size={14} />
      </button>
      <button
        type="button"
        className={`${styles.action}${widget.locked ? ` ${styles.on}` : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleLocked();
        }}
        aria-label={widget.locked ? "Unlock widget" : "Lock widget"}
        title={widget.locked ? "Unlock" : "Lock"}
      >
        <Icon name={widget.locked ? "Lock" : "LockOpen"} size={14} />
      </button>
    </div>
  );
}
