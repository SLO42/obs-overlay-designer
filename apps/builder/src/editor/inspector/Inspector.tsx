import { useState } from "react";
import { Icon, IconButton, Kbd, Tabs, Tooltip } from "@obs/design-system";
import { useEditorStore } from "../../store";
import { InspectorForm } from "./InspectorForm";
import styles from "./Inspector.module.css";

type InspectorTab = "style" | "data" | "triggers" | "debug";

/**
 * Right rail. When exactly one widget is selected, shows a tabbed view
 * (Style, Data, Triggers, Debug) with only Style functional for Task 6.
 * Multi-select or empty selection show placeholder copy.
 */
export function Inspector() {
  const selection = useEditorStore((s) => s.selection);
  const widgets = useEditorStore((s) => s.project.widgets);
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const removeWidgets = useEditorStore((s) => s.removeWidgets);
  const [tab, setTab] = useState<InspectorTab>("style");

  const widget = selection.length === 1 ? widgets.find((w) => w.id === selection[0]) : undefined;

  if (!widget) {
    return (
      <div className={styles.root}>
        <div className={styles.emptyState}>
          <Icon name="Layers" size={28} />
          <div className={styles.emptyTitle}>
            {selection.length === 0 ? "Nothing selected" : `${selection.length} widgets selected`}
          </div>
          <div className={styles.emptyHint}>
            {selection.length === 0 ? (
              <>
                Click a widget on the canvas
                <br />
                or add one from the Widgets tab
              </>
            ) : (
              <>Select a single widget to edit its properties</>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <input
          className={styles.name}
          value={widget.name}
          onChange={(event) => updateWidget(widget.id, { name: event.target.value })}
          aria-label="Widget name"
        />
        <Tooltip
          content={
            <span>
              Delete <Kbd>Del</Kbd>
            </span>
          }
        >
          <IconButton
            aria-label="Delete widget"
            size="sm"
            onClick={() => removeWidgets([widget.id])}
          >
            <Icon name="Trash2" />
          </IconButton>
        </Tooltip>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as InspectorTab)}>
        <div className={styles.tabs}>
          <Tabs.List aria-label="Inspector sections">
            <Tabs.Trigger value="style">Style</Tabs.Trigger>
            <Tabs.Trigger value="data">Data</Tabs.Trigger>
            <Tabs.Trigger value="triggers">Triggers</Tabs.Trigger>
            <Tabs.Trigger value="debug">Debug</Tabs.Trigger>
          </Tabs.List>
        </div>
        <div className={styles.body}>
          <Tabs.Content value="style">
            <InspectorForm widget={widget} />
          </Tabs.Content>
          <Tabs.Content value="data">
            <div className={styles.unsupported}>Data sources land in Task 8.</div>
          </Tabs.Content>
          <Tabs.Content value="triggers">
            <div className={styles.unsupported}>Triggers land in a later task.</div>
          </Tabs.Content>
          <Tabs.Content value="debug">
            <div className={styles.unsupported}>Live event log coming with Task 8.</div>
          </Tabs.Content>
        </div>
      </Tabs>
    </div>
  );
}
