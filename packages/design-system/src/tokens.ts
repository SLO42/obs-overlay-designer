/**
 * TypeScript mirror of the `colors_and_type.css` tokens. Primitives import
 * these types so props can be typed against the brand scale. If a token is
 * added / removed from the CSS, update this file to match.
 */

/* ---------- Spacing ---------- */
export const SPACING_KEYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16] as const;
export type SpacingKey = (typeof SPACING_KEYS)[number];

/** `spacing(4)` → `"var(--space-4)"`. Useful in inline styles or CSS-in-JS. */
export const spacing = (key: SpacingKey): string => `var(--space-${key})`;

/* ---------- Row heights ---------- */
export type RowSize = "xs" | "sm" | "md" | "lg" | "xl";
export const rowHeight = (size: RowSize): string => `var(--size-row-${size})`;

/* ---------- Surfaces / panels ---------- */
export type Tone = "default" | "raised" | "nested";

/* ---------- Button ---------- */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/* ---------- Input size ---------- */
export type InputSize = "sm" | "md";

/* ---------- Badge ---------- */
export type BadgeVariant = "ok" | "warn" | "danger" | "info" | "accent" | "neutral";

/* ---------- Signal lanes ---------- */
export type SignalLane = "chat" | "alerts" | "emotes" | "points" | "events";
export const laneVar = (lane: SignalLane): string => `var(--c-lane-${lane})`;

/* ---------- Radii ---------- */
export type Radius = "sm" | "md" | "lg" | "xl" | "full";
export const radius = (r: Radius): string => `var(--radius-${r})`;

/* ---------- Shadows ---------- */
export type Shadow = "sm" | "md" | "lg" | "glow" | "inset";
export const shadow = (s: Shadow): string => `var(--shadow-${s})`;

/* ---------- Motion ---------- */
export type Duration = "fast" | "base" | "slow" | "scene";
export const duration = (d: Duration): string => `var(--dur-${d})`;

export type Easing = "out" | "in-out" | "spring";
export const easing = (e: Easing): string => `var(--ease-${e})`;

/* ---------- Z-index ---------- */
export type ZLayer = "base" | "sticky" | "dropdown" | "overlay" | "modal" | "tooltip" | "toast";
export const zIndex = (layer: ZLayer): string => `var(--z-${layer})`;
