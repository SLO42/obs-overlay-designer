import { useState } from "react";
import {
  AppShell,
  Badge,
  Button,
  Checkbox,
  ColorInput,
  Dialog,
  Icon,
  IconButton,
  InspectorField,
  Input,
  Kbd,
  Logo,
  Menu,
  NumberField,
  Panel,
  Select,
  Slider,
  Stack,
  Switch,
  Tabs,
  Tooltip,
} from "@obs/design-system";

type Tool = "widgets" | "layers" | "preview" | "assets";

export function App() {
  const [tab, setTab] = useState("builder");
  const [activeTool, setActiveTool] = useState<Tool>("widgets");
  const [name, setName] = useState("Main chat feed");
  const [fontSize, setFontSize] = useState(14);
  const [opacity, setOpacity] = useState(0.85);
  const [tint, setTint] = useState("#8b5cf6");
  const [dim, setDim] = useState(true);
  const [showBadges, setShowBadges] = useState(false);
  const [align, setAlign] = useState("center");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deployCount, setDeployCount] = useState(0);

  return (
    <AppShell
      toolbar={
        <Stack direction="row" gap={3} align="center" style={{ width: "100%", height: "100%" }}>
          <Stack direction="row" gap={3} align="center">
            <Logo size={22} />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "15px",
                fontWeight: 700,
                color: "var(--fg-primary)",
                letterSpacing: "-0.5px",
              }}
            >
              streamteam
            </span>
          </Stack>
          <div
            style={{
              width: 1,
              height: 20,
              background: "var(--border-subtle)",
              marginLeft: 8,
              marginRight: 8,
            }}
          />
          <Tabs value={tab} onValueChange={setTab}>
            <Tabs.List aria-label="App section">
              <Tabs.Trigger value="builder">Builder</Tabs.Trigger>
              <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
              <Tabs.Trigger value="deploy">Deploy</Tabs.Trigger>
            </Tabs.List>
          </Tabs>
          <Badge variant="danger" pulse>
            LIVE · 1920×1080
          </Badge>
          <div style={{ flex: 1 }} />
          <Stack direction="row" gap={1} align="center">
            <Tooltip content="Undo">
              <IconButton aria-label="Undo">
                <Icon name="Undo2" />
              </IconButton>
            </Tooltip>
            <Tooltip content="Redo">
              <IconButton aria-label="Redo">
                <Icon name="Redo2" />
              </IconButton>
            </Tooltip>
            <Tooltip content="Open settings">
              <IconButton aria-label="Settings" onClick={() => setSettingsOpen(true)}>
                <Icon name="Settings" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Button
            variant="primary"
            size="sm"
            kbd="⌘⏎"
            leading={<Icon name="Rocket" size={14} />}
            onClick={() => setDeployCount((n) => n + 1)}
          >
            Deploy
          </Button>
        </Stack>
      }
      left={
        <Stack gap={2} align="center" style={{ padding: "10px 8px" }}>
          <Tooltip content="Widgets" side="right">
            <IconButton
              aria-label="Widgets"
              active={activeTool === "widgets"}
              onClick={() => setActiveTool("widgets")}
            >
              <Icon name="LayoutGrid" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Layers" side="right">
            <IconButton
              aria-label="Layers"
              active={activeTool === "layers"}
              onClick={() => setActiveTool("layers")}
            >
              <Icon name="Layers" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Preview" side="right">
            <IconButton
              aria-label="Preview"
              active={activeTool === "preview"}
              onClick={() => setActiveTool("preview")}
            >
              <Icon name="Eye" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Assets" side="right">
            <IconButton
              aria-label="Assets"
              active={activeTool === "assets"}
              onClick={() => setActiveTool("assets")}
            >
              <Icon name="Image" />
            </IconButton>
          </Tooltip>
        </Stack>
      }
      right={
        <Stack gap={3} style={{ padding: 12, height: "100%" }}>
          <Panel tone="raised" padding={4}>
            <Stack gap={1}>
              <span style={{ color: "var(--fg-primary)", fontWeight: 600, fontSize: 13 }}>
                Inspector
              </span>
              <span className="ds-caption" style={{ display: "block" }} data-testid="deploy-count">
                Deploys this session: {deployCount}
              </span>
              <div style={{ height: 8 }} />
              <InspectorField label="Name" description="Widget display name">
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </InspectorField>
              <InspectorField label="Font size" description="Arrow ↑/↓ ±1 · shift ×10 · alt ÷10">
                <NumberField
                  value={fontSize}
                  onChange={setFontSize}
                  min={8}
                  max={72}
                  step={1}
                  suffix="px"
                />
              </InspectorField>
              <InspectorField label="Opacity" description="Keyboard arrows, PgUp/Dn, Home/End">
                <Slider
                  value={opacity}
                  onChange={setOpacity}
                  min={0}
                  max={1}
                  step={0.01}
                  aria-label="Opacity"
                />
              </InspectorField>
              <InspectorField label="Tint" description="Normalized #rrggbb">
                <ColorInput value={tint} onChange={setTint} />
              </InspectorField>
              <InspectorField label="Dim on idle">
                <Switch checked={dim} onChange={setDim} aria-label="Dim on idle" />
              </InspectorField>
              <InspectorField label="Badges">
                <Stack direction="row" gap={2} align="center">
                  <Checkbox
                    checked={showBadges}
                    onChange={setShowBadges}
                    aria-label="Show chat badges"
                  />
                  <span style={{ fontSize: 12, color: "var(--fg-body)" }}>Show chat badges</span>
                </Stack>
              </InspectorField>
              <InspectorField label="Align">
                <Select
                  value={align}
                  onValueChange={setAlign}
                  aria-label="Alignment"
                  options={[
                    { value: "left", label: "Left" },
                    { value: "center", label: "Center" },
                    { value: "right", label: "Right" },
                  ]}
                />
              </InspectorField>
            </Stack>
          </Panel>
        </Stack>
      }
    >
      <div
        className="ds-canvas-bg"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-muted)",
        }}
      >
        <Stack gap={3} align="center">
          <span style={{ fontFamily: "var(--font-display)", fontSize: 32 }}>Canvas → Task 6</span>
          <span className="ds-caption">
            Stage chrome, layer rail, and live preview arrive in the next task.
          </span>
          <Kbd>⌘K</Kbd>
        </Stack>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Dialog.Title>Settings</Dialog.Title>
        <Dialog.Description>
          Confirms focus trap, ESC to close, overlay fade, and content slide-up.
        </Dialog.Description>
        <Dialog.Body>
          <InspectorField label="EventSub" description="Nested menu inside a modal dialog">
            <Menu
              trigger={
                <Button
                  size="sm"
                  leading={<Icon name="Server" size={14} />}
                  trailing={<Icon name="ChevronDown" size={14} />}
                >
                  Endpoint…
                </Button>
              }
            >
              <Menu.Item onSelect={() => undefined}>Auto-detect</Menu.Item>
              <Menu.Item onSelect={() => undefined}>Override URL…</Menu.Item>
              <Menu.Separator />
              <Menu.Sub label="Advanced">
                <Menu.Item onSelect={() => undefined}>Force reconnect</Menu.Item>
                <Menu.Item onSelect={() => undefined}>Disable EventSub</Menu.Item>
              </Menu.Sub>
            </Menu>
          </InspectorField>
          <InspectorField label="Token">
            <Input placeholder="twitch oauth token" defaultValue="" />
          </InspectorField>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onClick={() => setSettingsOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => setSettingsOpen(false)}>
            Save
          </Button>
        </Dialog.Footer>
      </Dialog>
    </AppShell>
  );
}
