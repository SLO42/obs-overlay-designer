import { InspectorField, NumberField, Stack } from "@obs/design-system";
import type { Effect } from "@obs/core";

type EmoteRainEffect = Extract<Effect, { type: "emote-rain" }>;

interface EmoteRainEditorProps {
  effect: EmoteRainEffect;
  onChange: (patch: Partial<EmoteRainEffect>) => void;
}

/**
 * Only duration is authorable today — the emote URL pool is threaded in
 * via the effect context at render time (from the overlay), not stored on
 * the effect itself.
 */
export function EmoteRainEditor({ effect, onChange }: EmoteRainEditorProps) {
  return (
    <Stack gap={2}>
      <InspectorField label="Duration">
        <NumberField
          value={effect.durationMs}
          min={500}
          max={20000}
          step={100}
          onChange={(next) => onChange({ durationMs: Math.round(next) })}
          suffix="ms"
          aria-label="Emote rain duration"
        />
      </InspectorField>
    </Stack>
  );
}
