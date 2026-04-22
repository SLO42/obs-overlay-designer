import { useEffect, useMemo, useRef } from "react";
import type { Effect as CoreEffect, StreamEvent, TriggerMatcher, Widget } from "@obs/core";
import { isDefaultBus, useEventBus, useWidgetHostRegistry } from "@obs/core";
import { Icon } from "@obs/design-system";
import { playEffect, type Cleanup, type EffectContext } from "@obs/effects";
import { matchTrigger } from "../triggerEngine";
import type { CustomTriggerProps, CustomTriggerRule } from "./schema";
import styles from "./Runtime.module.css";

export interface CustomTriggerRuntimeProps {
  widget: Widget<CustomTriggerProps>;
}

/**
 * Narrowed event kinds each matcher type cares about. Mirrors the per-self
 * engine in `../triggerEngine.ts`; we can't reuse that helper because it's
 * scoped to `TriggerMatcher`, but the schemas line up exactly.
 */
function matcherKinds(matcher: CustomTriggerRule["matcher"]): StreamEvent["kind"][] {
  switch (matcher.type) {
    case "chat.keyword":
    case "chat.command":
      return ["chat.message"];
    case "channel.redeem":
      return ["channel.channel_points_custom_reward_redemption.add"];
    case "channel.cheer":
      return ["channel.cheer"];
    case "donation":
      return ["donation"];
  }
}

/**
 * Resolve the set of target widget ids a rule addresses. Self-id is
 * always filtered — a CustomTrigger never fires effects on itself, even
 * if it somehow ends up in the list.
 */
function resolveTargets(
  rule: CustomTriggerRule,
  selfId: string,
  fanOut: boolean,
  allIds: string[],
): string[] {
  if (rule.targets.length > 0) {
    return rule.targets.filter((id) => id !== selfId);
  }
  if (fanOut) {
    return allIds.filter((id) => id !== selfId);
  }
  return [];
}

/**
 * The CustomTrigger widget is invisible at runtime: it doesn't render
 * into the overlay's DOM tree at all. Instead it subscribes to the stream
 * bus and, for each matching event, plays the rule's effects on the
 * registered host element of every target widget.
 *
 * Design-mode (builder canvas) renders a small labeled pill so authors
 * can see the widget on the canvas; no subscription happens there.
 */
export function CustomTriggerRuntime({ widget }: CustomTriggerRuntimeProps) {
  const bus = useEventBus();
  const registry = useWidgetHostRegistry();
  const { rules, fanOutWhenTargetsEmpty } = widget.props;

  // `rulesRef` lets the dispatcher read the latest rules without tearing
  // down + re-subscribing on every keystroke in the Inspector. The effect
  // below depends on a stable `subscribedKinds` signature so the rule
  // list can change freely within that kind set.
  const rulesRef = useRef<CustomTriggerRule[]>(rules);
  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  // A stable string summary of the event kinds any enabled rule cares
  // about. Used as an effect dep — changing the set re-subscribes, but
  // rule edits within the same set do not.
  const kindsKey = useMemo(() => {
    const set = new Set<StreamEvent["kind"]>();
    for (const rule of rules) {
      if (!rule.enabled) continue;
      for (const k of matcherKinds(rule.matcher)) set.add(k);
    }
    return Array.from(set).sort().join("|");
  }, [rules]);

  useEffect(() => {
    if (isDefaultBus(bus) || !registry) return;
    if (kindsKey.length === 0) return;

    // Cleanups for in-flight effect plays. Called on unmount. Not
    // actively pruned mid-run because `playEffect` guarantees idempotent
    // cleanups (guarded by `once()` in the effects registry).
    const active = new Set<Cleanup>();

    const subscribedKinds = kindsKey.split("|") as StreamEvent["kind"][];

    const dispatch = (_event: StreamEvent, rule: CustomTriggerRule) => {
      const ctx: EffectContext = { respectReducedMotion: true };
      const targetIds = resolveTargets(rule, widget.id, fanOutWhenTargetsEmpty, registry.ids());
      for (const targetId of targetIds) {
        const host = registry.get(targetId);
        // Unknown target id (was deleted, never existed) — skip silently.
        if (!host) continue;
        for (const effect of rule.effects) {
          try {
            // Our schema's effect is structurally identical to `@obs/core`'s
            // `Effect`; the cast collapses the two nominally separate types.
            const cleanup = playEffect(host, effect as unknown as CoreEffect, ctx);
            active.add(cleanup);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(
              `[customTrigger] playEffect threw for effect "${effect.id}" (${effect.type})`,
              err,
            );
          }
        }
      }
    };

    const offs: Array<() => void> = [];
    for (const kind of subscribedKinds) {
      const off = bus.onKind(kind, ((event: StreamEvent) => {
        // Re-read the current rules snapshot on every event so mid-flight
        // edits in the Inspector take effect without a resubscribe cycle.
        for (const rule of rulesRef.current) {
          if (!rule.enabled) continue;
          if (!matcherKinds(rule.matcher).includes(kind)) continue;
          // The cast is safe: our matcher schema mirrors `TriggerMatcher`
          // 1:1 (same discriminator + same field names), so the predicate
          // produces correct booleans.
          if (!matchTrigger(event, rule.matcher as TriggerMatcher)) continue;
          dispatch(event, rule);
        }
      }) as Parameters<typeof bus.onKind>[1]);
      offs.push(off);
    }

    return () => {
      for (const off of offs) off();
      for (const cleanup of active) {
        try {
          cleanup();
        } catch {
          // Cleanup is guarded; swallow any residual throw so the next
          // cleanup still runs.
        }
      }
      active.clear();
    };
  }, [bus, registry, widget.id, fanOutWhenTargetsEmpty, kindsKey]);

  // Design mode: render a labeled pill anchored to the widget's host box
  // so authors see the widget on the canvas. Runtime mode: invisible.
  if (isDefaultBus(bus)) {
    const ruleCount = rules.length;
    return (
      <div className={styles.badge} data-testid="custom-trigger-badge">
        <Icon name="Zap" size={12} />
        <span className={styles.badgeLabel}>
          Custom trigger · {ruleCount} rule{ruleCount === 1 ? "" : "s"}
        </span>
      </div>
    );
  }
  return null;
}
