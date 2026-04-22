import type { Widget } from "@obs/core";
import { EffectsSection } from "./EffectsSection";
import { TriggersSection } from "./TriggersSection";
import styles from "./TriggersTab.module.css";

interface TriggersTabProps {
  widget: Widget;
}

/**
 * Body of the Inspector's "Triggers" tab. Two sections:
 *   1. Effects — author visual effects attached to the widget.
 *   2. Triggers — wire matchers (chat/points/cheer/donation) to those
 *      effects by id.
 *
 * The split exists because `Trigger.effects` is a list of effect-ids that
 * reference entries in `widget.effects`. Authoring effects first, then
 * referencing them from triggers, is the natural flow — and mirrors the
 * on-disk shape so export diffs stay readable.
 */
export function TriggersTab({ widget }: TriggersTabProps) {
  return (
    <div className={styles.root}>
      <EffectsSection widget={widget} />
      <TriggersSection widget={widget} />
    </div>
  );
}
