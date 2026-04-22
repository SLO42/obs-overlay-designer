import {
  Badge,
  Button,
  Checkbox,
  ColorInput,
  Icon,
  IconButton,
  Input,
  InspectorField,
  Menu,
  NumberField,
  Panel,
  Stack,
  Switch,
} from "@obs/design-system";
import type { BadgeVariant } from "@obs/design-system";
import { id as makeId, type Widget } from "@obs/core";
import { useCanvasWidgets } from "./CanvasWidgetsContext";
import type {
  CustomTriggerEffect,
  CustomTriggerMatcher,
  CustomTriggerProps,
  CustomTriggerRule,
} from "./schema";
import styles from "./Inspector.module.css";

type MatcherType = CustomTriggerMatcher["type"];
type EffectType = CustomTriggerEffect["type"];
type ChatRole = "viewer" | "subscriber" | "vip" | "mod" | "broadcaster";

export interface CustomTriggerInspectorProps {
  widget: Widget<CustomTriggerProps>;
  update: (patch: Partial<CustomTriggerProps>) => void;
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
function matcherMetaFor(t: MatcherType): MatcherMeta {
  return MATCHER_META.find((m) => m.type === t) ?? MATCHER_META[0]!;
}

interface EffectMeta {
  type: EffectType;
  label: string;
}
const EFFECT_META: readonly EffectMeta[] = [
  { type: "shake", label: "Shake" },
  { type: "flash", label: "Flash" },
  { type: "zoom-punch", label: "Zoom punch" },
  { type: "confetti", label: "Confetti" },
  { type: "emote-rain", label: "Emote rain" },
];
function effectMetaFor(t: EffectType): EffectMeta {
  return EFFECT_META.find((m) => m.type === t) ?? EFFECT_META[0]!;
}

const ALL_ROLES: Array<{ value: ChatRole; label: string }> = [
  { value: "viewer", label: "Viewer" },
  { value: "subscriber", label: "Subscriber" },
  { value: "vip", label: "VIP" },
  { value: "mod", label: "Mod" },
  { value: "broadcaster", label: "Broadcaster" },
];

/**
 * Defaults for each matcher type — keyword/command empty strings guard
 * against "match every message" the moment a new rule is added (the
 * triggerEngine's `matchTrigger` returns false on empty keyword/command).
 */
function createDefaultMatcher(type: MatcherType): CustomTriggerMatcher {
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
 * Fresh effect objects with a unique id so the runtime's effect list is
 * stable across edits (edit a confetti count → same id, no retear of the
 * registered effect).
 */
function createDefaultEffect(type: EffectType): CustomTriggerEffect {
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
 * Top-level Inspector for the CustomTrigger widget. Authors rules via a
 * nested card list; each rule is a matcher + a target picker + an effects
 * list. Edits are committed through the `update({ rules })` callback
 * supplied by the builder's InspectorForm.
 */
export function CustomTriggerInspector({ widget, update }: CustomTriggerInspectorProps) {
  const { rules, fanOutWhenTargetsEmpty } = widget.props;
  const canvas = useCanvasWidgets();

  const setRules = (next: CustomTriggerRule[]) => update({ rules: next });

  const addRule = (type: MatcherType) => {
    const rule: CustomTriggerRule = {
      id: makeId(),
      enabled: true,
      matcher: createDefaultMatcher(type),
      targets: [],
      effects: [],
    };
    setRules([...rules, rule]);
  };

  const removeRule = (ruleId: string) => {
    setRules(rules.filter((r) => r.id !== ruleId));
  };

  const updateRule = (ruleId: string, patch: Partial<CustomTriggerRule>) => {
    setRules(rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)));
  };

  // Canvas widget list minus self — the target picker shows these. If the
  // context isn't mounted (isolated test), we degrade to an empty array.
  const canvasWidgets = canvas?.widgets ?? [];
  const targetCandidates = canvasWidgets.filter((w) => w.id !== widget.id);

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <InspectorField
          label="Fan out to all widgets when no targets picked"
          description="When a rule has zero targets selected, fires on every other widget."
        >
          <Switch
            checked={fanOutWhenTargetsEmpty}
            onChange={(next) => update({ fanOutWhenTargetsEmpty: next })}
            aria-label="Fan out to all widgets when no targets picked"
          />
        </InspectorField>
      </div>

      <div className={styles.headerRow}>
        <div className={styles.subLabel}>Rules</div>
        <Menu
          trigger={
            <Button size="sm" leading={<Icon name="Plus" size={12} />}>
              Add rule
            </Button>
          }
          align="end"
        >
          {MATCHER_META.map((meta) => (
            <Menu.Item key={meta.type} onSelect={() => addRule(meta.type)}>
              {meta.label}
            </Menu.Item>
          ))}
        </Menu>
      </div>

      {rules.length === 0 ? (
        <div className={styles.emptyState} data-empty="rules">
          No rules yet. Add one above to start wiring events to effects on other widgets.
        </div>
      ) : (
        <div className={styles.rulesList}>
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              targetCandidates={targetCandidates}
              onRemove={() => removeRule(rule.id)}
              onChange={(patch) => updateRule(rule.id, patch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RuleCardProps {
  rule: CustomTriggerRule;
  targetCandidates: Array<Pick<Widget, "id" | "kind" | "name">>;
  onRemove: () => void;
  onChange: (patch: Partial<CustomTriggerRule>) => void;
}

function RuleCard({ rule, targetCandidates, onRemove, onChange }: RuleCardProps) {
  const meta = matcherMetaFor(rule.matcher.type);

  const toggleTarget = (targetId: string) => {
    const next = rule.targets.includes(targetId)
      ? rule.targets.filter((id) => id !== targetId)
      : [...rule.targets, targetId];
    onChange({ targets: next });
  };

  const addEffect = (type: EffectType) => {
    onChange({ effects: [...rule.effects, createDefaultEffect(type)] });
  };
  const removeEffect = (effectId: string) => {
    onChange({ effects: rule.effects.filter((e) => e.id !== effectId) });
  };
  const updateEffect = (effectId: string, patch: Partial<CustomTriggerEffect>) => {
    onChange({
      effects: rule.effects.map((e) =>
        e.id === effectId ? ({ ...e, ...patch } as CustomTriggerEffect) : e,
      ),
    });
  };

  return (
    <Panel
      tone="nested"
      padding={3}
      data-rule-id={rule.id}
      data-rule-type={rule.matcher.type}
      data-rule-enabled={rule.enabled ? "" : undefined}
    >
      <div className={styles.cardHeader}>
        <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
        <div className={styles.cardHeaderRight}>
          <Switch
            checked={rule.enabled}
            onChange={(next) => onChange({ enabled: next })}
            aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
          />
          <IconButton aria-label="Remove rule" size="sm" onClick={onRemove}>
            <Icon name="Trash2" size={14} />
          </IconButton>
        </div>
      </div>

      <div className={styles.cardBody}>
        <MatcherEditor matcher={rule.matcher} onChange={(m) => onChange({ matcher: m })} />

        <div>
          <div className={styles.subLabel}>Targets</div>
          {targetCandidates.length === 0 ? (
            <div className={styles.hint} data-empty="no-targets">
              No other widgets on the canvas yet. Add another widget to pick targets.
            </div>
          ) : (
            <>
              <div className={styles.targetsList}>
                {targetCandidates.map((w) => {
                  const checked = rule.targets.includes(w.id);
                  return (
                    <label key={w.id} className={styles.targetRow} data-target-id={w.id}>
                      <Checkbox
                        checked={checked}
                        onChange={() => toggleTarget(w.id)}
                        aria-label={`Target ${w.name || w.kind}`}
                      />
                      <span>{w.name || w.kind}</span>
                      <span className={styles.targetKind}>{w.kind}</span>
                    </label>
                  );
                })}
              </div>
              <div className={styles.hint}>
                Leave all unchecked to fan out to every widget (when the toggle above is on).
              </div>
            </>
          )}
        </div>

        <div>
          <div className={styles.headerRow}>
            <div className={styles.subLabel}>Effects</div>
            <Menu
              trigger={
                <Button size="sm" leading={<Icon name="Plus" size={12} />}>
                  Add effect
                </Button>
              }
              align="end"
            >
              {EFFECT_META.map((m) => (
                <Menu.Item key={m.type} onSelect={() => addEffect(m.type)}>
                  {m.label}
                </Menu.Item>
              ))}
            </Menu>
          </div>
          {rule.effects.length === 0 ? (
            <div className={styles.hint} data-empty="effects">
              No effects yet. Add one to make this rule do something visible.
            </div>
          ) : (
            <div className={styles.effectsList}>
              {rule.effects.map((effect) => (
                <EffectRow
                  key={effect.id}
                  effect={effect}
                  onRemove={() => removeEffect(effect.id)}
                  onChange={(patch) => updateEffect(effect.id, patch)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------------- */
/* Matcher editors — inlined, minimal versions.                            */
/* Duplication with apps/builder/src/editor/inspector/triggers is a known  */
/* trade-off; the builder's versions use RewardSelect for channel.redeem,  */
/* which lives in the app and can't be pulled into a package cleanly.      */
/* ---------------------------------------------------------------------- */

interface MatcherEditorProps {
  matcher: CustomTriggerMatcher;
  onChange: (m: CustomTriggerMatcher) => void;
}

function MatcherEditor({ matcher, onChange }: MatcherEditorProps) {
  switch (matcher.type) {
    case "chat.keyword": {
      const roles = matcher.roles ?? [];
      const toggleRole = (role: ChatRole) => {
        const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
        onChange({ ...matcher, roles: next });
      };
      return (
        <Stack gap={2}>
          <InspectorField label="Keyword">
            <Input
              value={matcher.keyword}
              onChange={(e) => onChange({ ...matcher, keyword: e.target.value })}
              placeholder="hype"
              aria-label="Keyword"
            />
          </InspectorField>
          <InspectorField label="Case sensitive">
            <Switch
              checked={matcher.caseSensitive ?? false}
              onChange={(next) => onChange({ ...matcher, caseSensitive: next })}
              aria-label="Case sensitive match"
            />
          </InspectorField>
          <InspectorField
            label="Roles"
            description={
              roles.length === 0 ? "Any user role matches" : "User must have at least one role"
            }
          >
            <div className={styles.rolesGrid}>
              {ALL_ROLES.map((r) => {
                const checked = roles.includes(r.value);
                return (
                  <label key={r.value} className={styles.roleItem}>
                    <Checkbox
                      checked={checked}
                      onChange={() => toggleRole(r.value)}
                      aria-label={`Role: ${r.label}`}
                    />
                    <span>{r.label}</span>
                  </label>
                );
              })}
            </div>
          </InspectorField>
        </Stack>
      );
    }
    case "chat.command":
      return (
        <InspectorField label="Command" description="Matches as a prefix after trim">
          <Input
            value={matcher.command}
            onChange={(e) => onChange({ ...matcher, command: e.target.value })}
            placeholder="!hype"
            aria-label="Command"
          />
        </InspectorField>
      );
    case "channel.redeem":
      return (
        <InspectorField label="Reward id" description="Paste a reward id from Twitch.">
          <Input
            value={matcher.rewardId}
            onChange={(e) => onChange({ ...matcher, rewardId: e.target.value })}
            placeholder="reward-uuid"
            aria-label="Reward id"
            spellCheck={false}
          />
        </InspectorField>
      );
    case "channel.cheer":
      return (
        <InspectorField label="Min bits">
          <NumberField
            value={matcher.minBits ?? 0}
            min={0}
            onChange={(next) => onChange({ ...matcher, minBits: Math.max(0, Math.round(next)) })}
            aria-label="Minimum bits"
          />
        </InspectorField>
      );
    case "donation":
      return (
        <Stack gap={2}>
          <InspectorField label="Min amount" description="In minor units (cents)">
            <NumberField
              value={matcher.minAmount ?? 0}
              min={0}
              onChange={(next) =>
                onChange({ ...matcher, minAmount: Math.max(0, Math.round(next)) })
              }
              aria-label="Minimum donation amount"
            />
          </InspectorField>
          <InspectorField label="Currency">
            <Input
              value={matcher.currency ?? ""}
              onChange={(e) =>
                onChange({
                  ...matcher,
                  currency:
                    e.target.value.length === 0
                      ? undefined
                      : e.target.value.toUpperCase().slice(0, 3),
                })
              }
              maxLength={3}
              placeholder="USD"
              aria-label="Currency code"
              spellCheck={false}
            />
          </InspectorField>
        </Stack>
      );
  }
}

/* ---------------------------------------------------------------------- */
/* Effect editors — inlined                                                */
/* ---------------------------------------------------------------------- */

interface EffectRowProps {
  effect: CustomTriggerEffect;
  onRemove: () => void;
  onChange: (patch: Partial<CustomTriggerEffect>) => void;
}

function EffectRow({ effect, onRemove, onChange }: EffectRowProps) {
  const meta = effectMetaFor(effect.type);
  return (
    <div className={styles.effectRow} data-effect-id={effect.id} data-effect-type={effect.type}>
      <div className={styles.effectRowHeader}>
        <div className={styles.effectRowHeaderLeft}>
          <span className={styles.effectTitle}>{meta.label}</span>
        </div>
        <IconButton aria-label={`Remove ${meta.label} effect`} size="sm" onClick={onRemove}>
          <Icon name="Trash2" size={14} />
        </IconButton>
      </div>
      <EffectBody effect={effect} onChange={onChange} />
    </div>
  );
}

function EffectBody({ effect, onChange }: Omit<EffectRowProps, "onRemove">) {
  switch (effect.type) {
    case "shake":
      return (
        <Stack gap={2}>
          <InspectorField label="Amplitude">
            <NumberField
              value={effect.amplitude}
              min={0}
              max={80}
              onChange={(next) => onChange({ amplitude: Math.round(next) })}
              suffix="px"
              aria-label="Shake amplitude"
            />
          </InspectorField>
          <InspectorField label="Duration">
            <NumberField
              value={effect.durationMs}
              min={50}
              max={5000}
              step={50}
              onChange={(next) => onChange({ durationMs: Math.round(next) })}
              suffix="ms"
              aria-label="Shake duration"
            />
          </InspectorField>
        </Stack>
      );
    case "flash":
      return (
        <Stack gap={2}>
          <InspectorField label="Color">
            <ColorInput value={effect.color} onChange={(next) => onChange({ color: next })} />
          </InspectorField>
          <InspectorField label="Duration">
            <NumberField
              value={effect.durationMs}
              min={50}
              max={5000}
              step={50}
              onChange={(next) => onChange({ durationMs: Math.round(next) })}
              suffix="ms"
              aria-label="Flash duration"
            />
          </InspectorField>
        </Stack>
      );
    case "zoom-punch":
      return (
        <Stack gap={2}>
          <InspectorField label="Scale">
            <NumberField
              value={effect.scale}
              min={1}
              max={3}
              step={0.01}
              precision={2}
              onChange={(next) => onChange({ scale: Number(next.toFixed(2)) })}
              aria-label="Zoom punch scale"
            />
          </InspectorField>
          <InspectorField label="Duration">
            <NumberField
              value={effect.durationMs}
              min={50}
              max={5000}
              step={50}
              onChange={(next) => onChange({ durationMs: Math.round(next) })}
              suffix="ms"
              aria-label="Zoom punch duration"
            />
          </InspectorField>
        </Stack>
      );
    case "confetti":
      return (
        <Stack gap={2}>
          <InspectorField label="Particles">
            <NumberField
              value={effect.count}
              min={1}
              max={500}
              onChange={(next) => onChange({ count: Math.max(1, Math.round(next)) })}
              aria-label="Confetti particle count"
            />
          </InspectorField>
          <InspectorField label="Duration">
            <NumberField
              value={effect.durationMs}
              min={200}
              max={10000}
              step={100}
              onChange={(next) => onChange({ durationMs: Math.round(next) })}
              suffix="ms"
              aria-label="Confetti duration"
            />
          </InspectorField>
        </Stack>
      );
    case "emote-rain":
      return (
        <InspectorField label="Duration">
          <NumberField
            value={effect.durationMs}
            min={500}
            max={20000}
            step={100}
            onChange={(next) => onChange({ durationMs: Math.round(next) })}
            suffix="ms"
            aria-label="Emote rain duration"
          />
        </InspectorField>
      );
  }
}
