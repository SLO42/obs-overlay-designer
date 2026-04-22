import { InspectorField, NumberField, Stack } from "@obs/design-system";
import type { Effect } from "@obs/core";

type ShakeEffect = Extract<Effect, { type: "shake" }>;

interface ShakeEditorProps {
  effect: ShakeEffect;
  onChange: (patch: Partial<ShakeEffect>) => void;
}

/**
 * Exposes the two tunable knobs for the shake effect: horizontal amplitude
 * (px) and total duration (ms). Values are clamped by `NumberField` via
 * the `min` props — negative amplitudes would flip direction uselessly.
 */
export function ShakeEditor({ effect, onChange }: ShakeEditorProps) {
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
}
