/**
 * Tiny class-name concat helper. Accepts strings, false/null/undefined
 * (skipped), and objects mapping class name -> boolean.
 * Avoids an extra dep on clsx/classnames.
 */

export type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | Record<string, boolean | null | undefined>;

export function cx(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v));
    } else if (typeof v === "object") {
      for (const key of Object.keys(v)) {
        if (v[key]) out.push(key);
      }
    }
  }
  return out.join(" ");
}
