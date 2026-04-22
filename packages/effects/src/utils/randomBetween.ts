/**
 * Uniform real number in `[min, max]`. Accepts an optional `rng` so tests
 * can seed determinism; defaults to `Math.random`.
 */
export function randomBetween(min: number, max: number, rng: () => number = Math.random): number {
  return min + rng() * (max - min);
}

/**
 * Pick one element from a non-empty array uniformly at random. Throws when
 * the array is empty so callers don't have to guard against `undefined`.
 */
export function pickRandom<T>(items: readonly T[], rng: () => number = Math.random): T {
  if (items.length === 0) throw new Error("pickRandom: items is empty");
  const idx = Math.floor(rng() * items.length);
  // Clamp in the rare case rng() returns exactly 1 (spec-legal for some PRNGs).
  const safe = idx >= items.length ? items.length - 1 : idx;
  return items[safe] as T;
}
