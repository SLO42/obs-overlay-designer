import { useEffect, type MutableRefObject } from "react";
import type {
  ChatMessage,
  CheerEvent,
  DonationEvent,
  Effect,
  RedeemEvent,
  StreamEvent,
  Trigger,
  TriggerMatcher,
  Widget,
} from "@obs/core";
import { isDefaultBus, useEventBus } from "@obs/core";
import { playEffect, type Cleanup, type EffectContext } from "@obs/effects";

export interface TriggerEngineOptions {
  /** Defaults to `true`. When enabled, `playEffect` is given
   *  `respectReducedMotion: true` via the effect context. */
  respectReducedMotion?: boolean;
  /** Emote URL pool threaded through to effect players that need it
   *  (e.g. `emote-rain`). */
  emoteUrls?: string[];
}

/**
 * Narrowed `event.kind` values a trigger matcher can listen on. Derived
 * directly from the `TriggerMatcher` union so any future matcher type gets
 * flagged here at compile time.
 */
function matcherKinds(matcher: TriggerMatcher): StreamEvent["kind"][] {
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
 * Pure predicate: does `event` satisfy `matcher`? Event kind is always
 * checked first so a chat.keyword matcher never gets tricked by a cheer
 * event that happens to share a field name.
 */
export function matchTrigger(event: StreamEvent, matcher: TriggerMatcher): boolean {
  switch (matcher.type) {
    case "chat.keyword": {
      if (event.kind !== "chat.message") return false;
      const chat = event as ChatMessage;
      if (matcher.keyword.length === 0) return false;
      const caseSensitive = matcher.caseSensitive ?? false;
      const haystack = caseSensitive ? chat.plain : chat.plain.toLowerCase();
      const needle = caseSensitive ? matcher.keyword : matcher.keyword.toLowerCase();
      if (!haystack.includes(needle)) return false;
      if (matcher.roles && matcher.roles.length > 0) {
        const userRoles = chat.user.roles ?? [];
        const hasRole = matcher.roles.some((r) => userRoles.includes(r));
        if (!hasRole) return false;
      }
      return true;
    }
    case "chat.command": {
      if (event.kind !== "chat.message") return false;
      const chat = event as ChatMessage;
      if (matcher.command.length === 0) return false;
      return chat.plain.trim().toLowerCase().startsWith(matcher.command.toLowerCase());
    }
    case "channel.redeem": {
      if (event.kind !== "channel.channel_points_custom_reward_redemption.add") return false;
      const redeem = event as RedeemEvent;
      if (matcher.rewardId.length === 0) return false;
      return redeem.rewardId === matcher.rewardId;
    }
    case "channel.cheer": {
      if (event.kind !== "channel.cheer") return false;
      const cheer = event as CheerEvent;
      return cheer.bits >= (matcher.minBits ?? 0);
    }
    case "donation": {
      if (event.kind !== "donation") return false;
      const donation = event as DonationEvent;
      if (matcher.currency && donation.currency !== matcher.currency) return false;
      if (typeof matcher.minAmount === "number" && donation.amount < matcher.minAmount)
        return false;
      return true;
    }
  }
}

/**
 * Index the widget's effects by id so trigger dispatch is O(effects) per
 * incoming event instead of O(triggers × effects).
 */
function indexEffects(effects: Effect[]): Map<string, Effect> {
  const out = new Map<string, Effect>();
  for (const e of effects) out.set(e.id, e);
  return out;
}

/**
 * Subscribes to the overlay bus for each event kind referenced by
 * `widget.triggers`, and fires `playEffect(host, effect)` for every
 * effect id a matching trigger references.
 *
 * No-op when the active bus is the default (Design mode in the builder).
 * The active cleanup set is tracked so unmount (or a widget change that
 * swaps the ruleset) tears down in-flight effect players cleanly.
 *
 * Errors inside individual `playEffect` calls are swallowed + logged so
 * one bad effect can't break the dispatch chain for the others.
 */
export function useTriggerEngine(
  widget: Widget,
  hostRef: MutableRefObject<HTMLElement | null>,
  opts?: TriggerEngineOptions,
): void {
  const bus = useEventBus();
  const respectReducedMotion = opts?.respectReducedMotion ?? true;
  const emoteUrls = opts?.emoteUrls;
  const triggers = widget.triggers;
  const effects = widget.effects;

  useEffect(() => {
    // Design mode: the builder canvas mounts Runtimes without an
    // OverlayBusProvider, so `bus` is the branded no-op. Nothing to wire.
    if (isDefaultBus(bus)) return;
    if (triggers.length === 0) return;

    const effectIndex = indexEffects(effects);
    // The unique set of event kinds any enabled trigger cares about.
    const subscribed = new Set<StreamEvent["kind"]>();
    for (const t of triggers) {
      if (!t.enabled) continue;
      for (const kind of matcherKinds(t.match)) subscribed.add(kind);
    }
    if (subscribed.size === 0) return;

    // Active cleanups from in-flight effect plays — we call every one on
    // unmount or when the widget's triggers/effects change.
    const active = new Set<Cleanup>();

    const dispatch = (event: StreamEvent, trigger: Trigger) => {
      const host = hostRef.current;
      if (!host) return;
      const ctx: EffectContext = { respectReducedMotion, emoteUrls };
      for (const effectId of trigger.effects) {
        const effect = effectIndex.get(effectId);
        if (!effect) {
          // eslint-disable-next-line no-console
          console.warn(
            `[triggerEngine] trigger ${trigger.id} references unknown effect id "${effectId}"`,
          );
          continue;
        }
        try {
          const cleanup = playEffect(host, effect, ctx);
          active.add(cleanup);
        } catch (err) {
          // playEffect itself catches + logs, but defensive double-catch
          // so an unexpected throw can't take out the whole handler.
          // eslint-disable-next-line no-console
          console.error(
            `[triggerEngine] playEffect threw for effect "${effect.id}" (${effect.type})`,
            err,
          );
        }
        // We don't actively garbage-collect `active` here — cleanups are
        // idempotent (guarded by `once()` in the effects registry) so a
        // later unmount-time sweep is safe even if the animation already
        // finished.
      }
    };

    const offs: Array<() => void> = [];
    for (const kind of subscribed) {
      // onKind's handler is strongly typed per kind; we re-broaden to
      // StreamEvent in the dispatcher below because matchTrigger discrim-
      // inates on event.kind again.
      const off = bus.onKind(kind, ((event: StreamEvent) => {
        for (const trigger of triggers) {
          if (!trigger.enabled) continue;
          if (!matcherKinds(trigger.match).includes(kind)) continue;
          if (!matchTrigger(event, trigger.match)) continue;
          dispatch(event, trigger);
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
          // Cleanups are guarded; ignore any residual throw so the next
          // cleanup still runs.
        }
      }
      active.clear();
    };
    // `triggers` + `effects` are the rulebook; resubscribe whenever either
    // reference changes (our store uses immer, so references flip only on
    // mutation). `bus` should be stable for the overlay lifetime, but we
    // depend on it anyway so the reload-the-bus test path is covered.
  }, [bus, triggers, effects, hostRef, respectReducedMotion, emoteUrls]);
}
