import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Icon,
  IconButton,
  Input,
  Kbd,
  Logo,
  Menu,
  Stack,
  Tabs,
  Tooltip,
} from "@obs/design-system";
import { id as makeId, type StreamEvent } from "@obs/core";
import { useEditorStore } from "../store";
import { SHORTCUTS } from "./shortcuts";
import type { StageMode } from "./Editor";

interface ToolbarProps {
  stage: StageMode;
  onStageChange: (stage: StageMode) => void;
}

/**
 * Test-event kinds exposed by the Toolbar's "Fire test event" menu. Each
 * picks a minimal valid payload that matches the `@obs/core` StreamEvent
 * discriminated union — the overlay bus accepts them verbatim.
 */
const TEST_EVENTS: Array<{ label: string; make: () => StreamEvent }> = [
  {
    label: "chat.message",
    make: () => ({
      kind: "chat.message",
      id: makeId(),
      user: {
        id: "tester",
        login: "tester",
        displayName: "Tester",
        roles: ["viewer"],
      },
      fragments: [{ type: "text", text: "Hello from the builder!" }],
      plain: "Hello from the builder!",
      receivedAt: Date.now(),
    }),
  },
  {
    label: "channel.cheer",
    make: () => ({
      kind: "channel.cheer",
      id: makeId(),
      user: { id: "tester", login: "tester", displayName: "Tester" },
      bits: 500,
      message: "cheer500 test",
      receivedAt: Date.now(),
    }),
  },
  {
    label: "channel.subscribe",
    make: () => ({
      kind: "channel.subscribe",
      id: makeId(),
      user: { id: "tester", login: "tester", displayName: "Tester" },
      tier: "1000",
      isGift: false,
      receivedAt: Date.now(),
    }),
  },
  {
    label: "channel.follow",
    make: () => ({
      kind: "channel.follow",
      id: makeId(),
      user: { id: "tester", login: "tester", displayName: "Tester" },
      receivedAt: Date.now(),
    }),
  },
  {
    label: "channel.raid",
    make: () => ({
      kind: "channel.raid",
      id: makeId(),
      from: { id: "tester", login: "tester", displayName: "Tester" },
      viewers: 42,
      receivedAt: Date.now(),
    }),
  },
  {
    label: "channel.points redemption",
    make: () => ({
      kind: "channel.channel_points_custom_reward_redemption.add",
      id: makeId(),
      user: { id: "tester", login: "tester", displayName: "Tester" },
      rewardId: "test-reward",
      rewardTitle: "Test Reward",
      receivedAt: Date.now(),
    }),
  },
  {
    label: "donation",
    make: () => ({
      kind: "donation",
      id: makeId(),
      source: "streamlabs",
      user: { displayName: "Tester" },
      amount: 500,
      currency: "USD",
      message: "thanks!",
      receivedAt: Date.now(),
    }),
  },
];

/**
 * Custom event used to signal the PreviewPane to forward a test StreamEvent
 * to the iframe. We don't have a shared bus between Toolbar and PreviewPane,
 * so a browser CustomEvent is the pragmatic bridge — Preview mode is
 * already inherently DOM-bound.
 */
export const PREVIEW_FIRE_EVENT = "builder/preview/fire-event";

function secondsAgo(ts?: number): string {
  if (!ts) return "never";
  const delta = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (delta < 60) return `${delta}s ago`;
  const minutes = Math.floor(delta / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function Toolbar({ stage, onStageChange }: ToolbarProps) {
  const projectName = useEditorStore((s) => s.project.meta.name);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.history.past.length > 0);
  const canRedo = useEditorStore((s) => s.history.future.length > 0);
  const status = useEditorStore((s) => s.status);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const project = useEditorStore((s) => s.project);

  // Local name buffer so we can debounce writes to the store. 250ms is
  // fast enough that undo-grouping stays intuitive but slow enough that a
  // rapid edit doesn't spam immer patches.
  const [nameBuffer, setNameBuffer] = useState(projectName);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setNameBuffer(projectName);
  }, [projectName]);

  const commitName = (next: string) => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      setProjectName(next);
    }, 250);
  };

  // Rerender every 10s so "Saved 2s ago" keeps ticking. Cheap — the badge
  // only rerenders with the toolbar, which is already cheap.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setTick((t) => t + 1), 10_000);
    return () => window.clearInterval(interval);
  }, []);

  const fireTestEvent = (event: StreamEvent) => {
    if (stage === "preview") {
      window.dispatchEvent(new CustomEvent(PREVIEW_FIRE_EVENT, { detail: event }));
    }
    // Design mode: no-op (tooltip copy warns user). Keeping a console.debug
    // so devs can confirm the menu wired up.
    console.debug("[toolbar] test event fired", event);
  };

  const savedBadge = (() => {
    if (status === "saving")
      return (
        <Badge variant="info" pulse>
          Saving…
        </Badge>
      );
    if (status === "error") return <Badge variant="danger">Save error</Badge>;
    if (status === "saved" || lastSavedAt) {
      return <Badge variant="ok">Saved {secondsAgo(lastSavedAt)}</Badge>;
    }
    return <Badge variant="neutral">Idle</Badge>;
  })();

  return (
    <Stack direction="row" gap={3} align="center" style={{ width: "100%", height: "100%" }}>
      <Stack direction="row" gap={2} align="center">
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
          marginLeft: 4,
          marginRight: 4,
        }}
      />
      <Input
        size="sm"
        aria-label="Project name"
        value={nameBuffer}
        onChange={(event) => {
          const next = event.target.value;
          setNameBuffer(next);
          commitName(next);
        }}
        style={{ width: 220 }}
      />
      <div style={{ flex: 1 }} />
      <Tabs value={stage} onValueChange={(v) => onStageChange(v as StageMode)}>
        <Tabs.List aria-label="Stage mode">
          <Tabs.Trigger value="design">Design</Tabs.Trigger>
          <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
        </Tabs.List>
      </Tabs>
      <div style={{ flex: 1 }} />
      <Stack direction="row" gap={1} align="center">
        <Tooltip
          content={
            <span>
              Undo <Kbd>{SHORTCUTS.undo.kbd}</Kbd>
            </span>
          }
        >
          <IconButton aria-label="Undo" disabled={!canUndo} onClick={() => undo()}>
            <Icon name="Undo2" />
          </IconButton>
        </Tooltip>
        <Tooltip
          content={
            <span>
              Redo <Kbd>{SHORTCUTS.redo.kbd}</Kbd>
            </span>
          }
        >
          <IconButton aria-label="Redo" disabled={!canRedo} onClick={() => redo()}>
            <Icon name="Redo2" />
          </IconButton>
        </Tooltip>
        <Menu
          trigger={
            <IconButton
              aria-label="Fire test event"
              title={
                stage === "preview"
                  ? "Fire a synthetic StreamEvent into the preview iframe"
                  : "Switch to Preview to fire events"
              }
            >
              <Icon name="Zap" />
            </IconButton>
          }
        >
          {TEST_EVENTS.map((te) => (
            <Menu.Item key={te.label} onSelect={() => fireTestEvent(te.make())}>
              {te.label}
            </Menu.Item>
          ))}
        </Menu>
      </Stack>
      {savedBadge}
      <Button
        variant="primary"
        size="sm"
        leading={<Icon name="Download" size={14} />}
        onClick={() => {
          // Task 7 wires the real export pipeline; log the project so the
          // shape is inspectable from the devtools console today.
          console.log("export", project);
        }}
      >
        Export
      </Button>
    </Stack>
  );
}
