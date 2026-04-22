import { z } from "zod";

/**
 * Matchers are a superset of `@obs/core`'s `TriggerMatcher` union rewritten
 * in zod, with explicit `.default(...)` on every field so the inspector's
 * "Add rule" menu can mint fully populated defaults via `schema.parse({})`.
 * The discriminator is `type`; cases mirror the `TriggerMatcher` type 1:1.
 */
const matcherSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat.keyword"),
    keyword: z.string().default(""),
    caseSensitive: z.boolean().optional(),
    roles: z.array(z.enum(["viewer", "subscriber", "vip", "mod", "broadcaster"])).optional(),
  }),
  z.object({
    type: z.literal("chat.command"),
    command: z.string().default("!"),
  }),
  z.object({
    type: z.literal("channel.redeem"),
    rewardId: z.string().default(""),
  }),
  z.object({
    type: z.literal("channel.cheer"),
    minBits: z.number().int().min(0).default(0),
  }),
  z.object({
    type: z.literal("donation"),
    minAmount: z.number().int().min(0).default(0),
    currency: z.string().max(6).optional(),
  }),
]);

export type CustomTriggerMatcher = z.infer<typeof matcherSchema>;

/**
 * Effects are a rewrite of `@obs/core`'s `Effect` union. Same shape, same
 * discriminator, same five types. Each effect gets a stable id so rules
 * can reference them if we ever want per-target overrides (not in Task 18).
 */
const effectSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("shake"),
    amplitude: z.number().default(8),
    durationMs: z.number().int().min(1).default(600),
  }),
  z.object({
    id: z.string(),
    type: z.literal("flash"),
    color: z.string().default("#8b5cf6"),
    durationMs: z.number().int().min(1).default(400),
  }),
  z.object({
    id: z.string(),
    type: z.literal("zoom-punch"),
    scale: z.number().default(1.08),
    durationMs: z.number().int().min(1).default(400),
  }),
  z.object({
    id: z.string(),
    type: z.literal("confetti"),
    count: z.number().int().min(1).default(40),
    durationMs: z.number().int().min(1).default(1400),
  }),
  z.object({
    id: z.string(),
    type: z.literal("emote-rain"),
    durationMs: z.number().int().min(1).default(4000),
  }),
]);

export type CustomTriggerEffect = z.infer<typeof effectSchema>;

/**
 * A single "when X, do Y to Z" rule. Targets is the list of widget ids on
 * the canvas the effects should play on. Empty + `fanOutWhenTargetsEmpty`
 * triggers the "fire on every widget" fallback at the widget level.
 */
const ruleSchema = z.object({
  id: z.string(),
  enabled: z.boolean().default(true),
  matcher: matcherSchema,
  /** Widget ids this rule targets. Self-id is always excluded at runtime. */
  targets: z.array(z.string()).default([]),
  effects: z.array(effectSchema).default([]),
});

export type CustomTriggerRule = z.infer<typeof ruleSchema>;

/**
 * CustomTrigger widget props. The widget is non-rendering at runtime —
 * the rules drive playEffect calls on OTHER widgets' host elements via
 * the `WidgetHostRegistry`.
 */
export const customTriggerSchema = z.object({
  rules: z.array(ruleSchema).default([]),
  /** When a rule has no explicit targets, fan out to every widget (minus self). */
  fanOutWhenTargetsEmpty: z.boolean().default(false),
});

export type CustomTriggerProps = z.infer<typeof customTriggerSchema>;

// Re-export for the Inspector & Runtime files; keeping the `Rule` alias
// in addition to `CustomTriggerRule` matches the task brief's naming.
export type Rule = CustomTriggerRule;
export type Matcher = CustomTriggerMatcher;
export type Effect = CustomTriggerEffect;
