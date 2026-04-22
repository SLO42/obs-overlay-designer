import { InspectorField, NumberField, Stack } from "@obs/design-system";
import type { Effect } from "@obs/core";

type ConfettiEffect = Extract<Effect, { type: "confetti" }>;

interface ConfettiEditorProps {
  effect: ConfettiEffect;
  onChange: (patch: Partial<ConfettiEffect>) => void;
}

/** Particle count + total shower duration for the confetti effect. */
export function ConfettiEditor({ effect, onChange }: ConfettiEditorProps) {
  return (
    <Stack gap={2}>
      <InspectorField label="Particles">
        <NumberField
          value={effect.count}
          min={1}
          max={500}
          onChange={(next) => onChange({ count: Math.max(1, Math.round(next)) })}
          aria-label="Confetti particle count"
        />
      </InspectorField>
      <InspectorField label="Duration">
        <NumberField
          value={effect.durationMs}
          min={200}
          max={10000}
          step={100}
          onChange={(next) => onChange({ durationMs: Math.round(next) })}
          suffix="ms"
          aria-label="Confetti duration"
        />
      </InspectorField>
    </Stack>
  );
}
