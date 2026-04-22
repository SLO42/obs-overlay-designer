import { ColorInput, InspectorField, NumberField, Stack } from "@obs/design-system";
import type { Effect } from "@obs/core";

type FlashEffect = Extract<Effect, { type: "flash" }>;

interface FlashEditorProps {
  effect: FlashEffect;
  onChange: (patch: Partial<FlashEffect>) => void;
}

/** Overlays a solid color pulse on the widget. */
export function FlashEditor({ effect, onChange }: FlashEditorProps) {
  return (
    <Stack gap={2}>
      <InspectorField label="Color">
        <ColorInput value={effect.color} onChange={(next) => onChange({ color: next })} />
      </InspectorField>
      <InspectorField label="Duration">
        <NumberField
          value={effect.durationMs}
          min={50}
          max={5000}
          step={50}
          onChange={(next) => onChange({ durationMs: Math.round(next) })}
          suffix="ms"
          aria-label="Flash duration"
        />
      </InspectorField>
    </Stack>
  );
}
