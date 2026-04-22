/**
 * Keyboard shortcut metadata. The actual handlers live in KeyboardShortcuts.tsx
 * so they can read from / write to the store. Rendering Kbd hints in the
 * Toolbar uses these constants so the UI label and the handler never drift.
 *
 * Detection prefers `event.metaKey` on macOS (navigator.platform includes
 * "Mac") and `event.ctrlKey` elsewhere.
 */

export interface ShortcutDef {
  /** Human-readable label, used for Tooltips + menu hints. */
  kbd: string;
  /** Short action description, used in aria-labels when needed. */
  description: string;
}

export const SHORTCUTS = {
  undo: { kbd: "Ctrl+Z", description: "Undo" },
  redo: { kbd: "Ctrl+Shift+Z", description: "Redo" },
  duplicate: { kbd: "Ctrl+D", description: "Duplicate selection" },
  delete: { kbd: "Del", description: "Delete selection" },
  save: { kbd: "Ctrl+S", description: "Save" },
  nudge: { kbd: "Arrows", description: "Nudge 1px · Shift ×10" },
} satisfies Record<string, ShortcutDef>;

/**
 * True when the target looks like an editable control. Prevents us from
 * swallowing Delete/Backspace inside inputs (which the user presses to
 * delete characters, not widgets).
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  // Number sliders and switches are buttons; we don't want to gobble
  // the Delete key for them either.
  if (target.getAttribute("role") === "slider") return true;
  return false;
}

/** True on macOS — prefer cmd over ctrl. */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

export function isModKey(event: KeyboardEvent | React.KeyboardEvent): boolean {
  return isMac() ? event.metaKey : event.ctrlKey;
}
