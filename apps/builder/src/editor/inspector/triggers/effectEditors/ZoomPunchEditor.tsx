import { InspectorField, NumberField, Stack } from "@obs/design-system";
import type { Effect } from "@obs/core";

type ZoomPunchEffect = Extract<Effect, { type: "zoom-punch" }>;

interface ZoomPunchEditorProps {
  effect: ZoomPunchEffect;
  onChange: (patch: Partial<ZoomPunchEffect>) => void;
}

/**
 * Tunable scale factor + duration for the zoom-punch effect. `precision=2`
 * lets users nudge the scale by 0.01 with Alt+Arrow for subtle tweaks.
 */
export function ZoomPunchEditor({ effect, onChange }: ZoomPunchEditorProps) {
  return (
    <Stack gap={2}>
      <InspectorField label="Scale">
        <NumberField
          value={effect.scale}
          min={1}
          max={3}
          step={0.01}
          precision={2}
          onChange={(next) => onChange({ scale: Number(next.toFixed(2)) })}
          aria-label="Zoom punch scale"
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
          aria-label="Zoom punch duration"
        />
      </InspectorField>
    </Stack>
  );
}
