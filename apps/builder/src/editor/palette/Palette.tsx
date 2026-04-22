import { Icon, Tooltip, type IconName } from "@obs/design-system";
import { allWidgets } from "@obs/widgets";
import { useEditorStore } from "../../store";
import styles from "./Palette.module.css";

/**
 * Flat list of every registered widget. Clicking adds the widget to the
 * project (via the zustand store) and selects it so the Inspector auto-
 * focuses on the new instance. Grouping by signal lane is deferred to
 * Phase 2 — with only Text + Image registered, a flat list is clearer.
 */
export function Palette() {
  const widgets = allWidgets();
  const addWidget = useEditorStore((s) => s.addWidget);
  const setSelection = useEditorStore((s) => s.setSelection);

  return (
    <div className={styles.root}>
      <div className={styles.list}>
        {widgets.map((def) => (
          <Tooltip key={def.kind} content={def.description} side="right">
            <button
              className={styles.item}
              type="button"
              onClick={() => {
                const id = addWidget(def.kind);
                if (id) setSelection([id]);
              }}
            >
              <span className={styles.icon}>
                <Icon name={def.icon as IconName} size={16} />
              </span>
              <span className={styles.meta}>
                <span className={styles.name}>{def.label}</span>
                <span className={styles.desc}>{def.description}</span>
              </span>
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
