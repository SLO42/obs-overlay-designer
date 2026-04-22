import { InspectorField, NumberField, Stack } from "@obs/design-system";
import type { TriggerMatcher } from "@obs/core";

type ChannelCheerMatcher = Extract<TriggerMatcher, { type: "channel.cheer" }>;

interface ChannelCheerEditorProps {
  matcher: ChannelCheerMatcher;
  onChange: (patch: Partial<ChannelCheerMatcher>) => void;
}

/**
 * Channel cheer matcher — gates on a `minBits` threshold. A value of 0
 * matches any cheer.
 */
export function ChannelCheerEditor({ matcher, onChange }: ChannelCheerEditorProps) {
  return (
    <Stack gap={2}>
      <InspectorField label="Min bits">
        <NumberField
          value={matcher.minBits ?? 0}
          min={0}
          onChange={(next) => onChange({ minBits: Math.max(0, Math.round(next)) })}
          aria-label="Minimum bits"
        />
      </InspectorField>
    </Stack>
  );
}
