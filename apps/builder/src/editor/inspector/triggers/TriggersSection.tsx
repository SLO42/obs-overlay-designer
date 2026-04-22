import { Badge, Button, Icon, IconButton, Menu, Panel, Switch } from "@obs/design-system";
import type { BadgeVariant } from "@obs/design-system";
import {
  id as makeId,
  type Effect,
  type Trigger,
  type TriggerMatcher,
  type Widget,
} from "@obs/core";
import { useEditorStore } from "../../../store";
import { ChatKeywordEditor } from "./matcherEditors/ChatKeywordEditor";
import { ChatCommandEditor } from "./matcherEditors/ChatCommandEditor";
import { ChannelRedeemEditor } from "./matcherEditors/ChannelRedeemEditor";
import { ChannelCheerEditor } from "./matcherEditors/ChannelCheerEditor";
import { DonationEditor } from "./matcherEditors/DonationEditor";
import styles from "./TriggersTab.module.css";

type MatcherType = TriggerMatcher["type"];

interface TriggersSectionProps {
  widget: Widget;
}

interface MatcherMeta {
  type: MatcherType;
  label: string;
  badgeVariant: BadgeVariant;
}

const MATCHER_META: readonly MatcherMeta[] = [
  { type: "chat.keyword", label: "Chat keyword", badgeVariant: "info" },
  { type: "chat.command", label: "Chat command", badgeVariant: "info" },
  { type: "channel.redeem", label: "Channel point redeem", badgeVariant: "accent" },
  { type: "channel.cheer", label: "Cheer", badgeVariant: "warn" },
  { type: "donation", label: "Donation", badgeVariant: "ok" },
];

function matcherMetaFor(type: MatcherType): MatcherMeta {
  return MATCHER_META.find((m) => m.type === type) ?? MATCHER_META[0]!;
}

/**
 * Build a fresh `TriggerMatcher` with sensible defaults. Keyword / command
 * defaults leave the input empty so the `matchTrigger` engine's empty-
 * keyword guard prevents an accidental "match every message" rule the
 * instant a new trigger is added.
 */
export function createDefaultMatcher(type: MatcherType): TriggerMatcher {
  switch (type) {
    case "chat.keyword":
      return { type: "chat.keyword", keyword: "", caseSensitive: false, roles: [] };
    case "chat.command":
      return { type: "chat.command", command: "!" };
    case "channel.redeem":
      return { type: "channel.redeem", rewardId: "" };
    case "channel.cheer":
      return { type: "channel.cheer", minBits: 100 };
    case "donation":
      return { type: "donation", minAmount: 100, currency: "USD" };
  }
}

/**
 * Bottom section of the Triggers tab — the widget's trigger list. Each
 * trigger references zero or more effects by id; the chip row at the
 * bottom of each card is the wiring UI.
 */
export function TriggersSection({ widget }: TriggersSectionProps) {
  const addTrigger = useEditorStore((s) => s.addTrigger);
  const removeTrigger = useEditorStore((s) => s.removeTrigger);
  const updateTrigger = useEditorStore((s) => s.updateTrigger);

  const handleAdd = (type: MatcherType) => {
    const trigger: Trigger = {
      id: makeId(),
      match: createDefaultMatcher(type),
      effects: [],
      enabled: true,
    };
    addTrigger(widget.id, trigger);
  };

  return (
    <section className={styles.section} aria-label="Triggers">
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Triggers</h3>
        <Menu
          trigger={
            <Button size="sm" leading={<Icon name="Plus" size={12} />}>
              Add trigger
            </Button>
          }
          align="end"
        >
          {MATCHER_META.map((meta) => (
            <Menu.Item key={meta.type} onSelect={() => handleAdd(meta.type)}>
              {meta.label}
            </Menu.Item>
          ))}
        </Menu>
      </div>

      {widget.triggers.length === 0 ? (
        <div className={styles.emptyState} data-empty="triggers">
          No triggers yet. Add a matcher to react to events.
        </div>
      ) : (
        <div className={styles.cardList}>
          {widget.triggers.map((trigger) => (
            <TriggerCard
              key={trigger.id}
              trigger={trigger}
              effects={widget.effects}
              onRemove={() => removeTrigger(widget.id, trigger.id)}
              onChange={(patch) => updateTrigger(widget.id, trigger.id, patch)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface TriggerCardProps {
  trigger: Trigger;
  effects: Effect[];
  onRemove: () => void;
  onChange: (patch: Partial<Trigger>) => void;
}

function TriggerCard({ trigger, effects, onRemove, onChange }: TriggerCardProps) {
  const meta = matcherMetaFor(trigger.match.type);

  const toggleEffect = (effectId: string) => {
    const next = trigger.effects.includes(effectId)
      ? trigger.effects.filter((id) => id !== effectId)
      : [...trigger.effects, effectId];
    onChange({ effects: next });
  };

  return (
    <Panel
      tone="nested"
      padding={3}
      data-trigger-id={trigger.id}
      data-trigger-type={trigger.match.type}
      data-trigger-enabled={trigger.enabled ? "" : undefined}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderLeft}>
          <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Switch
            checked={trigger.enabled}
            onChange={(next) => onChange({ enabled: next })}
            aria-label={trigger.enabled ? "Disable trigger" : "Enable trigger"}
          />
          <IconButton aria-label="Remove trigger" size="sm" onClick={onRemove}>
            <Icon name="Trash2" size={14} />
          </IconButton>
        </div>
      </div>

      <div className={styles.cardBody}>
        {renderMatcherEditor(trigger, onChange)}

        <div className={styles.subLabel}>Effects to fire</div>
        {effects.length === 0 ? (
          <div className={styles.effectChipHint} data-hint="no-effects">
            Add an effect above first.
          </div>
        ) : (
          <div className={styles.effectChips} role="group" aria-label="Effects to fire">
            {effects.map((effect) => {
              const checked = trigger.effects.includes(effect.id);
              return (
                <button
                  key={effect.id}
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={`${effect.type} — ${checked ? "on" : "off"}`}
                  data-effect-id={effect.id}
                  className={
                    checked ? `${styles.effectChip} ${styles.effectChipActive}` : styles.effectChip
                  }
                  onClick={() => toggleEffect(effect.id)}
                >
                  {effect.type}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}

function renderMatcherEditor(trigger: Trigger, onChange: (patch: Partial<Trigger>) => void) {
  const onMatcherChange = (patch: Partial<TriggerMatcher>) => {
    // Preserve the matcher's discriminant — shallow-merge the rest. The
    // cast is safe because the editor only fires with patches shaped for
    // its own matcher subtype.
    onChange({ match: { ...trigger.match, ...patch } as TriggerMatcher });
  };

  switch (trigger.match.type) {
    case "chat.keyword":
      return <ChatKeywordEditor matcher={trigger.match} onChange={onMatcherChange as never} />;
    case "chat.command":
      return <ChatCommandEditor matcher={trigger.match} onChange={onMatcherChange as never} />;
    case "channel.redeem":
      return <ChannelRedeemEditor matcher={trigger.match} onChange={onMatcherChange as never} />;
    case "channel.cheer":
      return <ChannelCheerEditor matcher={trigger.match} onChange={onMatcherChange as never} />;
    case "donation":
      return <DonationEditor matcher={trigger.match} onChange={onMatcherChange as never} />;
  }
}
