import { useEffect, useMemo, useState } from "react";
import {
  ColorInput,
  Input,
  InspectorField,
  NumberField,
  Panel,
  Select,
  Slider,
  Stack,
  Switch,
} from "@obs/design-system";
import type { Widget } from "@obs/core";
import { useRewards } from "@obs/twitch";
import type { ChannelPointAlertProps } from "./schema";

interface ChannelPointAlertInspectorProps {
  widget: Widget<ChannelPointAlertProps>;
  update: (patch: Partial<ChannelPointAlertProps>) => void;
}

const CUSTOM_SENTINEL = "__custom__";
const FONT_OPTIONS = [
  { value: "sans", label: "Sans" },
  { value: "display", label: "Display" },
  { value: "mono", label: "Mono" },
];
const ENTRANCE_OPTIONS = [
  { value: "slide-up", label: "Slide up" },
  { value: "slide-in", label: "Slide in" },
  { value: "scale", label: "Scale" },
  { value: "fade", label: "Fade" },
];
const EXIT_OPTIONS = [
  { value: "slide-down", label: "Slide down" },
  { value: "slide-out", label: "Slide out" },
  { value: "scale", label: "Scale" },
  { value: "fade", label: "Fade" },
];

/**
 * Custom Inspector for the ChannelPointAlert widget. Renders (mostly) the
 * same controls the auto-form `ZodRenderer` would, but swaps the
 * `rewardId` field for a Select backed by `useRewards()`. Users without a
 * connected Twitch fall back to free-text entry so authored projects
 * remain editable offline.
 */
export function ChannelPointAlertInspector({ widget, update }: ChannelPointAlertInspectorProps) {
  const props = widget.props;
  const rewardsApi = useRewards();
  const [customMode, setCustomMode] = useState(false);

  const rewards = rewardsApi.rewards;
  const matches = useMemo(
    () => !!rewards && !!props.rewardId && rewards.some((r) => r.id === props.rewardId),
    [rewards, props.rewardId],
  );

  // Drop custom mode once the list arrives with a matching id.
  useEffect(() => {
    if (matches) setCustomMode(false);
  }, [matches]);

  const rewardIdField = (() => {
    if (!rewardsApi.available || !rewards) {
      return (
        <Stack gap={1}>
          <Input
            value={props.rewardId}
            onChange={(e) => update({ rewardId: e.target.value })}
            placeholder="reward-uuid"
            spellCheck={false}
          />
          <span style={{ color: "var(--fg-muted)", fontSize: 11 }}>
            Connect Twitch to pick from your rewards.
          </span>
        </Stack>
      );
    }
    if (customMode || (props.rewardId && !matches)) {
      return (
        <Stack gap={1}>
          <Input
            value={props.rewardId}
            onChange={(e) => update({ rewardId: e.target.value })}
            placeholder="reward-uuid"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => {
              setCustomMode(false);
              update({ rewardId: "" });
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--fg-secondary)",
              fontSize: 11,
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            Pick from list instead
          </button>
        </Stack>
      );
    }
    const options = [
      { value: "", label: "Any reward" },
      ...rewards.map((r) => ({ value: r.id, label: `${r.title} · ${r.cost} pts` })),
      { value: CUSTOM_SENTINEL, label: "Custom…" },
    ];
    return (
      <Select
        value={props.rewardId || ""}
        onValueChange={(next) => {
          if (next === CUSTOM_SENTINEL) {
            setCustomMode(true);
            return;
          }
          update({ rewardId: next });
        }}
        options={options}
        aria-label="Reward"
      />
    );
  })();

  return (
    <Stack gap={3}>
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-secondary)" }}>
            Filter
          </span>
          <InspectorField
            label="Reward"
            description="Pick the reward this alert celebrates. Choose “Any reward” to match every redemption."
          >
            {rewardIdField}
          </InspectorField>
          <InspectorField
            label="Title contains"
            description="Case-insensitive substring. Ignored when a specific reward is picked."
          >
            <Input
              value={props.rewardTitleContains}
              onChange={(e) => update({ rewardTitleContains: e.target.value })}
              placeholder="optional filter"
            />
          </InspectorField>
        </Stack>
      </Panel>
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-secondary)" }}>
            Templates
          </span>
          <InspectorField label="Title">
            <Input value={props.title} onChange={(e) => update({ title: e.target.value })} />
          </InspectorField>
          <InspectorField label="Subtitle">
            <Input value={props.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
          </InspectorField>
          <InspectorField label="Accent">
            <ColorInput value={props.accent} onChange={(next) => update({ accent: next })} />
          </InspectorField>
        </Stack>
      </Panel>
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-secondary)" }}>Media</span>
          <InspectorField label="Image URL">
            <Input
              value={props.imageUrl}
              onChange={(e) => update({ imageUrl: e.target.value })}
              placeholder="https://…"
            />
          </InspectorField>
          <InspectorField label="Audio URL">
            <Input
              value={props.audioUrl}
              onChange={(e) => update({ audioUrl: e.target.value })}
              placeholder="https://…"
            />
          </InspectorField>
          <InspectorField label="Audio volume">
            <Slider
              aria-label="Audio volume"
              value={props.audioVolume}
              min={0}
              max={1}
              step={0.05}
              onChange={(next) => update({ audioVolume: next })}
            />
          </InspectorField>
        </Stack>
      </Panel>
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-secondary)" }}>Queue</span>
          <InspectorField label="Display (ms)">
            <NumberField
              value={props.displayMs}
              min={500}
              max={30_000}
              step={100}
              onChange={(next) => update({ displayMs: Math.round(next) })}
            />
          </InspectorField>
          <InspectorField label="Spacing (ms)">
            <NumberField
              value={props.spacingMs}
              min={0}
              max={5000}
              step={50}
              onChange={(next) => update({ spacingMs: Math.round(next) })}
            />
          </InspectorField>
          <InspectorField label="Max queue">
            <NumberField
              value={props.maxQueue}
              min={1}
              max={100}
              onChange={(next) => update({ maxQueue: Math.round(next) })}
            />
          </InspectorField>
          <InspectorField label="Entrance">
            <Select
              value={props.entranceAnim}
              onValueChange={(v) =>
                update({ entranceAnim: v as ChannelPointAlertProps["entranceAnim"] })
              }
              options={ENTRANCE_OPTIONS}
              aria-label="Entrance animation"
            />
          </InspectorField>
          <InspectorField label="Exit">
            <Select
              value={props.exitAnim}
              onValueChange={(v) => update({ exitAnim: v as ChannelPointAlertProps["exitAnim"] })}
              options={EXIT_OPTIONS}
              aria-label="Exit animation"
            />
          </InspectorField>
        </Stack>
      </Panel>
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-secondary)" }}>
            Visual
          </span>
          <InspectorField label="Font family">
            <Select
              value={props.fontFamily}
              onValueChange={(v) =>
                update({ fontFamily: v as ChannelPointAlertProps["fontFamily"] })
              }
              options={FONT_OPTIONS}
              aria-label="Font family"
            />
          </InspectorField>
          <InspectorField label="Title size">
            <NumberField
              value={props.titleSize}
              min={14}
              max={72}
              onChange={(next) => update({ titleSize: Math.round(next) })}
            />
          </InspectorField>
          <InspectorField label="Subtitle size">
            <NumberField
              value={props.subtitleSize}
              min={10}
              max={36}
              onChange={(next) => update({ subtitleSize: Math.round(next) })}
            />
          </InspectorField>
          <InspectorField label="Show badge">
            <Switch
              aria-label="Show badge"
              checked={props.showBadge}
              onChange={(next) => update({ showBadge: next })}
            />
          </InspectorField>
          <InspectorField label="Card padding">
            <NumberField
              value={props.cardPadding}
              min={4}
              max={48}
              onChange={(next) => update({ cardPadding: Math.round(next) })}
            />
          </InspectorField>
          <InspectorField label="Card radius">
            <NumberField
              value={props.cardRadius}
              min={0}
              max={32}
              onChange={(next) => update({ cardRadius: Math.round(next) })}
            />
          </InspectorField>
          <InspectorField label="Card background">
            <ColorInput value={props.cardBg} onChange={(next) => update({ cardBg: next })} />
          </InspectorField>
          <InspectorField label="Text shadow">
            <Switch
              aria-label="Text shadow"
              checked={props.textShadow}
              onChange={(next) => update({ textShadow: next })}
            />
          </InspectorField>
          <InspectorField label="Hide empty subtitle">
            <Switch
              aria-label="Hide empty subtitle"
              checked={props.hideEmptySubtitle}
              onChange={(next) => update({ hideEmptySubtitle: next })}
            />
          </InspectorField>
        </Stack>
      </Panel>
    </Stack>
  );
}
