import { Button, Icon, IconButton, Menu, Panel } from "@obs/design-system";
import type { IconName } from "@obs/design-system";
import { id as makeId, type Effect, type Widget } from "@obs/core";
import { useEditorStore } from "../../../store";
import { ShakeEditor } from "./effectEditors/ShakeEditor";
import { FlashEditor } from "./effectEditors/FlashEditor";
import { ZoomPunchEditor } from "./effectEditors/ZoomPunchEditor";
import { ConfettiEditor } from "./effectEditors/ConfettiEditor";
import { EmoteRainEditor } from "./effectEditors/EmoteRainEditor";
import styles from "./TriggersTab.module.css";

type EffectType = Effect["type"];

interface EffectsSectionProps {
  widget: Widget;
}

interface EffectMeta {
  type: EffectType;
  label: string;
  icon: IconName;
}

/**
 * Authoring metadata for each effect type. `label` is the user-facing
 * name; `icon` is a Lucide glyph rendered both in the "Add effect" menu
 * and in each card's header.
 */
const EFFECT_META: readonly EffectMeta[] = [
  { type: "shake", label: "Shake", icon: "Vibrate" },
  { type: "flash", label: "Flash", icon: "Sun" },
  { type: "zoom-punch", label: "Zoom Punch", icon: "ZoomIn" },
  { type: "confetti", label: "Confetti", icon: "PartyPopper" },
  { type: "emote-rain", label: "Emote Rain", icon: "Smile" },
];

function metaFor(type: EffectType): EffectMeta {
  // Fallback is defensive — the effect types are a closed union so this
  // branch shouldn't be reachable in practice.
  return EFFECT_META.find((m) => m.type === type) ?? EFFECT_META[0]!;
}

/**
 * Build a brand-new `Effect` for a given type. Keeps the defaults in one
 * place so the Add menu + tests agree on the initial values.
 */
export function createDefaultEffect(type: EffectType): Effect {
  switch (type) {
    case "shake":
      return { id: makeId(), type: "shake", amplitude: 8, durationMs: 600 };
    case "flash":
      return { id: makeId(), type: "flash", color: "#8b5cf6", durationMs: 400 };
    case "zoom-punch":
      return { id: makeId(), type: "zoom-punch", scale: 1.08, durationMs: 400 };
    case "confetti":
      return { id: makeId(), type: "confetti", count: 40, durationMs: 1400 };
    case "emote-rain":
      return { id: makeId(), type: "emote-rain", durationMs: 4000 };
  }
}

/**
 * Top section of the Triggers tab — the widget's effect library. Effects
 * are referenced by id from `Trigger.effects[]`, so authoring them up
 * front (before wiring triggers) is the recommended flow.
 */
export function EffectsSection({ widget }: EffectsSectionProps) {
  const addEffect = useEditorStore((s) => s.addEffect);
  const removeEffect = useEditorStore((s) => s.removeEffect);
  const updateEffect = useEditorStore((s) => s.updateEffect);

  return (
    <section className={styles.section} aria-label="Effects">
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Effects</h3>
        <Menu
          trigger={
            <Button size="sm" leading={<Icon name="Plus" size={12} />}>
              Add effect
            </Button>
          }
          align="end"
        >
          {EFFECT_META.map((meta) => (
            <Menu.Item
              key={meta.type}
              onSelect={() => addEffect(widget.id, createDefaultEffect(meta.type))}
            >
              <Icon name={meta.icon} size={14} />
              <span style={{ marginLeft: 8 }}>{meta.label}</span>
            </Menu.Item>
          ))}
        </Menu>
      </div>

      {widget.effects.length === 0 ? (
        <div className={styles.emptyState} data-empty="effects">
          No effects yet. Add one above to make triggers do something visible.
        </div>
      ) : (
        <div className={styles.cardList}>
          {widget.effects.map((effect) => (
            <EffectCard
              key={effect.id}
              effect={effect}
              onRemove={() => removeEffect(widget.id, effect.id)}
              onChange={(patch) => updateEffect(widget.id, effect.id, patch)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface EffectCardProps {
  effect: Effect;
  onRemove: () => void;
  onChange: (patch: Partial<Effect>) => void;
}

function EffectCard({ effect, onRemove, onChange }: EffectCardProps) {
  const meta = metaFor(effect.type);
  return (
    <Panel tone="nested" padding={3} data-effect-id={effect.id} data-effect-type={effect.type}>
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderLeft}>
          <Icon name={meta.icon} size={14} />
          <span className={styles.cardTitle}>{meta.label}</span>
        </div>
        <IconButton aria-label={`Remove ${meta.label} effect`} size="sm" onClick={onRemove}>
          <Icon name="Trash2" size={14} />
        </IconButton>
      </div>
      <div className={styles.cardBody}>{renderEditor(effect, onChange)}</div>
    </Panel>
  );
}

function renderEditor(effect: Effect, onChange: (patch: Partial<Effect>) => void) {
  switch (effect.type) {
    case "shake":
      return <ShakeEditor effect={effect} onChange={onChange as never} />;
    case "flash":
      return <FlashEditor effect={effect} onChange={onChange as never} />;
    case "zoom-punch":
      return <ZoomPunchEditor effect={effect} onChange={onChange as never} />;
    case "confetti":
      return <ConfettiEditor effect={effect} onChange={onChange as never} />;
    case "emote-rain":
      return <EmoteRainEditor effect={effect} onChange={onChange as never} />;
  }
}
