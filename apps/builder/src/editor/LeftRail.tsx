import { Tabs } from "@obs/design-system";
import { Palette } from "./palette/Palette";
import { LayersPanel } from "./layers/LayersPanel";

/**
 * Left rail shell — two tabs:
 *   - Widgets (palette of registered widget kinds)
 *   - Layers (flat tree of project.widgets, reversed so top = front)
 *
 * Overrides the AppShell's 56px default width via `styles.css`.
 */
export function LeftRail() {
  return (
    <Tabs
      defaultValue="widgets"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <div style={{ padding: "8px 10px 0 10px", borderBottom: "1px solid var(--border-subtle)" }}>
        <Tabs.List aria-label="Left rail sections">
          <Tabs.Trigger value="widgets">Widgets</Tabs.Trigger>
          <Tabs.Trigger value="layers">Layers</Tabs.Trigger>
        </Tabs.List>
      </div>
      <Tabs.Content value="widgets" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Palette />
      </Tabs.Content>
      <Tabs.Content value="layers" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <LayersPanel />
      </Tabs.Content>
    </Tabs>
  );
}
