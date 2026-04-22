import type { ComponentType } from "react";
import type { z } from "zod";
import { id as makeId, type Transform, type Widget, type WidgetKind } from "@obs/core";

/**
 * Event kinds a widget can subscribe to at runtime. Kept as a string literal
 * union so registry consumers can narrow per-widget without pulling the
 * full StreamEvent discriminator in.
 */
export type WidgetEventKind =
  | "chat.message"
  | "channel.cheer"
  | "channel.subscribe"
  | "channel.subscription.gift"
  | "channel.follow"
  | "channel.raid"
  | "channel.channel_points_custom_reward_redemption.add"
  | "donation";

/**
 * A single widget contribution to the registry. The builder reads this to
 * populate the palette + inspector; the overlay reads `Runtime` + `eventsConsumed`
 * to render + subscribe. `schema.parse(defaults())` must succeed.
 */
export interface WidgetDefinition<Props extends Record<string, unknown> = Record<string, unknown>> {
  /** Discriminator on `Widget.kind`. Must be unique across the registry. */
  kind: WidgetKind;
  /** Short display name in the palette. */
  label: string;
  /** One-liner shown on palette hover. */
  description: string;
  /** Lucide icon name; the builder resolves via `@obs/design-system` `<Icon />`. */
  icon: string;
  /**
   * Zod schema for the widget's `props`. The input type is widened to
   * `unknown` so schemas with `.default()`s (input ≠ output) still satisfy
   * the contract — the builder's inspector and `createWidget` only care
   * about the parsed/output shape.
   */
  schema: z.ZodType<Props, z.ZodTypeDef, unknown>;
  /** Factory for a fresh default props object. */
  defaults: () => Props;
  /** Optional transform override merged over the registry-wide default box. */
  defaultTransform?: () => Partial<Transform>;
  /** Runtime component used by overlay + live preview. */
  Runtime: ComponentType<{ widget: Widget<Props> }>;
  /**
   * Optional custom inspector component. Absent = builder auto-generates from
   * `schema` (auto-form lands in Task 6).
   */
  Inspector?: ComponentType<{ widget: Widget<Props>; update: (patch: Partial<Props>) => void }>;
  /** Event kinds the overlay should subscribe to on this widget's behalf. */
  eventsConsumed: WidgetEventKind[];
}

/**
 * Module-scoped singleton. Each widget's `index.ts` calls `registerWidget`
 * at import time; `packages/widgets/src/index.ts` pulls each widget module
 * purely for these side effects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<WidgetKind, WidgetDefinition<any>>();

/**
 * Registry-wide default transform — each widget can override dims + anchor
 * via `defaultTransform()`.
 */
const BASE_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  w: 400,
  h: 120,
  rotation: 0,
  zIndex: 0,
  anchor: { x: 0.5, y: 0.5 },
};

/**
 * Registers a widget definition. Duplicate kinds throw — re-registering is
 * a programming error (stale hot-reload aside, which this module does not
 * attempt to handle; the package is loaded once).
 */
export function registerWidget<P extends Record<string, unknown>>(def: WidgetDefinition<P>): void {
  if (registry.has(def.kind)) {
    throw new Error(`Widget kind "${def.kind}" is already registered`);
  }
  // The Map holds the loosest shape (`any` props) because TS is invariant
  // on generic class params. Retrieval is paired with the caller's known
  // Props type via `kind`, so this cast is load-bearing but safe.
  registry.set(def.kind, def);
}

/** Test-only: drop every registration. Not exported from the barrel. */
export function __resetRegistryForTests(): void {
  registry.clear();
}

export function getWidget(kind: WidgetKind): WidgetDefinition | undefined {
  return registry.get(kind);
}

export function allWidgets(): WidgetDefinition[] {
  return Array.from(registry.values());
}

export interface CreateWidgetPreset {
  name?: string;
  transform?: Partial<Transform>;
  props?: Record<string, unknown>;
}

/**
 * Mints a new `Widget` instance from a registered kind.
 * - Starts with `defaults()` then shallow-merges `preset.props`.
 * - Starts with `BASE_TRANSFORM` + `defaultTransform()` then overlays `preset.transform`.
 * - Always mints a fresh id.
 * Throws if `kind` is not registered.
 */
export function createWidget(kind: WidgetKind, preset: CreateWidgetPreset = {}): Widget {
  const def = registry.get(kind);
  if (!def) {
    throw new Error(`Widget kind "${kind}" is not registered`);
  }
  const props = { ...def.defaults(), ...(preset.props ?? {}) };
  const transform: Transform = {
    ...BASE_TRANSFORM,
    ...(def.defaultTransform?.() ?? {}),
    ...(preset.transform ?? {}),
  };
  return {
    id: makeId(),
    kind: def.kind,
    name: preset.name ?? def.label,
    transform,
    props,
    triggers: [],
    effects: [],
  };
}
