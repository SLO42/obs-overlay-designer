import { Input, InspectorField, Stack } from "@obs/design-system";
import type { TriggerMatcher } from "@obs/core";

type ChannelRedeemMatcher = Extract<TriggerMatcher, { type: "channel.redeem" }>;

interface ChannelRedeemEditorProps {
  matcher: ChannelRedeemMatcher;
  onChange: (patch: Partial<ChannelRedeemMatcher>) => void;
}

/**
 * Channel points reward matcher. Task 19 replaces the free-text input with
 * a Select sourced from Helix so streamers pick from their existing
 * rewards; for now the raw id is authored by hand (copyable from the
 * debug event log).
 */
export function ChannelRedeemEditor({ matcher, onChange }: ChannelRedeemEditorProps) {
  return (
    <Stack gap={2}>
      <InspectorField label="Reward ID" description="Reward picker lands in a later task">
        <Input
          value={matcher.rewardId}
          onChange={(event) => onChange({ rewardId: event.target.value })}
          placeholder="reward-uuid"
          aria-label="Reward id"
          spellCheck={false}
        />
      </InspectorField>
    </Stack>
  );
}
