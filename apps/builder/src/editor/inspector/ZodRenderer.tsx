import { z, type ZodTypeAny } from "zod";
import {
  ColorInput,
  Input,
  InspectorField,
  NumberField,
  Panel,
  Select,
  Slider,
  Stack,
  Switch,
} from "@obs/design-system";
import styles from "./Inspector.module.css";

/** Max recursion depth for nested z.object() fields. */
export const MAX_DEPTH = 4;

/** camelCase → "Camel Case". Used for auto-generated field labels. */
export function startCase(key: string): string {
  const spaced = key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim();
  if (spaced.length === 0) return key;
  return spaced[0]!.toUpperCase() + spaced.slice(1);
}

/**
 * Unwrap ZodOptional / ZodDefault / ZodNullable / ZodEffects wrappers so
 * the renderer can inspect the underlying node.
 */
function unwrap(schema: ZodTypeAny): ZodTypeAny {
  let cur = schema;
  while (true) {
    if (cur instanceof z.ZodOptional) {
      cur = cur.unwrap();
      continue;
    }
    if (cur instanceof z.ZodDefault) {
      cur = cur.removeDefault();
      continue;
    }
    if (cur instanceof z.ZodNullable) {
      cur = cur.unwrap();
      continue;
    }
    if (cur instanceof z.ZodEffects) {
      cur = cur.innerType();
      continue;
    }
    break;
  }
  return cur;
}

/** Extract string `.description(...)` from a zod schema. */
function descriptionOf(schema: ZodTypeAny): string {
  return schema._def.description ?? "";
}

/**
 * True when the schema carries a regex check that looks like a hex color,
 * OR the field name / description hints color. The task table makes these
 * the forcing conditions for a ColorInput.
 */
function looksLikeColor(key: string, schema: ZodTypeAny): boolean {
  const lowerKey = key.toLowerCase();
  if (lowerKey === "color" || lowerKey.endsWith("color")) return true;
  if (lowerKey.startsWith("color")) return true;
  const desc = descriptionOf(schema).toLowerCase();
  if (desc.includes("color")) return true;
  if (schema instanceof z.ZodString) {
    const checks = (schema._def as { checks?: Array<{ kind: string; regex?: RegExp }> }).checks;
    if (checks) {
      for (const c of checks) {
        if (c.kind === "regex" && c.regex) {
          const src = c.regex.source;
          if (/#.*\[0-9a-fA-F\]\{6/.test(src) || src.includes("[0-9a-fA-F]{8}")) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Extract min/max/step from a `z.number()` node if present. Returns
 * `undefined` for each bound that isn't constrained.
 */
function numberBounds(schema: z.ZodNumber): {
  min?: number;
  max?: number;
  step?: number;
  isInt: boolean;
} {
  const def = schema._def as {
    checks: Array<{
      kind: string;
      value?: number;
      inclusive?: boolean;
    }>;
  };
  let min: number | undefined;
  let max: number | undefined;
  let step: number | undefined;
  let isInt = false;
  for (const c of def.checks) {
    if (c.kind === "min" && typeof c.value === "number") min = c.value;
    if (c.kind === "max" && typeof c.value === "number") max = c.value;
    if (c.kind === "multipleOf" && typeof c.value === "number") step = c.value;
    if (c.kind === "int") isInt = true;
  }
  return { min, max, step, isInt };
}

const SLIDER_KEYS = new Set(["opacity", "scale", "letterSpacing", "lineHeight", "zoom"]);

/** Returns true when the field should use the Slider primitive. */
function preferSlider(key: string, min: number | undefined, max: number | undefined): boolean {
  if (min === undefined || max === undefined) return false;
  if (max - min > 10) return false;
  return SLIDER_KEYS.has(key);
}

interface RenderProps {
  /** The field key (camelCase). */
  name: string;
  /** The zod schema for this field. */
  schema: ZodTypeAny;
  /** Current value (parsed). */
  value: unknown;
  /** Path of ancestor keys for setter targeting. */
  path: string[];
  /** Root onChange that receives a path + new value. */
  onChange: (path: string[], next: unknown) => void;
  /** Recursion depth; cap at MAX_DEPTH. */
  depth: number;
  /** Control id for the htmlFor wiring. */
  id: string;
}

function renderField(props: RenderProps): JSX.Element | null {
  const { name, schema, value, path, onChange, depth, id } = props;
  const raw = unwrap(schema);
  const label = startCase(name);
  const description = descriptionOf(schema) || descriptionOf(raw);

  const set = (next: unknown) => onChange(path, next);

  if (raw instanceof z.ZodString) {
    const current = typeof value === "string" ? value : "";
    if (looksLikeColor(name, raw)) {
      // ColorInput normalizes to #rrggbb. Hex8 values from the schema
      // still display fine but the ColorInput will narrow on blur; that's
      // acceptable scope.
      return (
        <InspectorField key={id} label={label} description={description} htmlFor={id}>
          <ColorInput id={id} value={current || "#000000"} onChange={(next) => set(next)} />
        </InspectorField>
      );
    }
    const placeholder = name === "src" || name === "url" ? "https://…" : undefined;
    return (
      <InspectorField key={id} label={label} description={description} htmlFor={id}>
        <Input
          id={id}
          value={current}
          placeholder={placeholder}
          onChange={(event) => set(event.target.value)}
        />
      </InspectorField>
    );
  }

  if (raw instanceof z.ZodNumber) {
    const current = typeof value === "number" ? value : 0;
    const { min, max, step, isInt } = numberBounds(raw);
    if (preferSlider(name, min, max)) {
      return (
        <InspectorField key={id} label={label} description={description} htmlFor={id}>
          <Slider
            aria-label={label}
            value={current}
            min={min}
            max={max}
            step={step ?? (max! - min!) / 100}
            onChange={(next) => set(next)}
          />
        </InspectorField>
      );
    }
    return (
      <InspectorField key={id} label={label} description={description} htmlFor={id}>
        <NumberField
          id={id}
          value={current}
          min={min}
          max={max}
          step={step ?? 1}
          precision={isInt ? 0 : 2}
          onChange={(next) => set(next)}
        />
      </InspectorField>
    );
  }

  if (raw instanceof z.ZodBoolean) {
    const current = typeof value === "boolean" ? value : false;
    return (
      <InspectorField key={id} label={label} description={description} htmlFor={id}>
        <Switch aria-label={label} checked={current} onChange={(next) => set(next)} />
      </InspectorField>
    );
  }

  if (raw instanceof z.ZodEnum) {
    const values = raw.options as readonly string[];
    const current = typeof value === "string" ? value : (values[0] ?? "");
    return (
      <InspectorField key={id} label={label} description={description} htmlFor={id}>
        <Select
          id={id}
          value={current}
          onValueChange={(next) => set(next)}
          options={values.map((v) => ({ value: v, label: startCase(v) }))}
        />
      </InspectorField>
    );
  }

  if (raw instanceof z.ZodObject) {
    if (depth >= MAX_DEPTH) {
      return (
        <InspectorField key={id} label={label} description="(nested past max depth)">
          <Input disabled placeholder="(nested)" />
        </InspectorField>
      );
    }
    const shape = raw.shape as Record<string, ZodTypeAny>;
    const childValue = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return (
      <Panel key={id} tone="nested" padding={3}>
        <div className={styles.sectionTitle}>{label}</div>
        <Stack gap={2}>
          {Object.entries(shape).map(([childKey, childSchema]) =>
            renderField({
              name: childKey,
              schema: childSchema,
              value: childValue[childKey],
              path: [...path, childKey],
              onChange,
              depth: depth + 1,
              id: `${id}.${childKey}`,
            }),
          )}
        </Stack>
      </Panel>
    );
  }

  // Union / Literal / Any / Record / Array / etc. render a disabled input
  // with a helpful placeholder. We only need Text + Image shapes today;
  // unions are used in imageSchema's `src` field — handled as a string.
  if (raw instanceof z.ZodUnion) {
    // If *any* member of the union is a string, treat as a string.
    const options = raw._def.options as ZodTypeAny[];
    const hasString = options.some((o) => unwrap(o) instanceof z.ZodString);
    if (hasString) {
      const current = typeof value === "string" ? value : "";
      const placeholder = name === "src" || name === "url" ? "https://…" : undefined;
      return (
        <InspectorField key={id} label={label} description={description} htmlFor={id}>
          <Input
            id={id}
            value={current}
            placeholder={placeholder}
            onChange={(event) => set(event.target.value)}
          />
        </InspectorField>
      );
    }
  }

  // Last-resort fallback.
  return (
    <InspectorField key={id} label={label}>
      <Input disabled placeholder={`unsupported: ${raw._def.typeName ?? "unknown"}`} />
    </InspectorField>
  );
}

export interface ZodRendererProps {
  schema: z.ZodObject<z.ZodRawShape>;
  value: Record<string, unknown>;
  onChange: (path: string[], next: unknown) => void;
  /** Prefix used to build control ids for htmlFor wiring. */
  idPrefix?: string;
}

/**
 * Walks a z.object() schema and emits one InspectorField per key. Used by
 * the Inspector's Style tab to auto-generate forms for the Text / Image
 * widget schemas (and any future schema built from the same primitives).
 */
export function ZodRenderer({ schema, value, onChange, idPrefix = "prop" }: ZodRendererProps) {
  const shape = schema.shape;
  return (
    <Stack gap={2}>
      {Object.entries(shape).map(([key, child]) =>
        renderField({
          name: key,
          schema: child as ZodTypeAny,
          value: value[key],
          path: [key],
          onChange,
          depth: 0,
          id: `${idPrefix}.${key}`,
        }),
      )}
    </Stack>
  );
}
