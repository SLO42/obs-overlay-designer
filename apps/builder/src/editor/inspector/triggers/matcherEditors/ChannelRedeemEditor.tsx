import { InspectorField, Stack } from "@obs/design-system";
import type { TriggerMatcher } from "@obs/core";
import { RewardSelect } from "../../../rewards/RewardSelect";

type ChannelRedeemMatcher = Extract<TriggerMatcher, { type: "channel.redeem" }>;

interface ChannelRedeemEditorProps {
  matcher: ChannelRedeemMatcher;
  onChange: (patch: Partial<ChannelRedeemMatcher>) => void;
}

/**
 * Channel points reward matcher. Task 19 replaces the free-text input with
 * a Select sourced from Helix (via `useRewards`) — a user with Twitch
 * connected picks from their existing rewards; offline or unconnected
 * users fall back to the plain input so authored projects remain editable.
 */
export function ChannelRedeemEditor({ matcher, onChange }: ChannelRedeemEditorProps) {
  return (
    <Stack gap={2}>
      <InspectorField
        label="Reward"
        description="Pick from your rewards when connected, or paste an ID."
      >
        <RewardSelect
          value={matcher.rewardId}
          onChange={(next) => onChange({ rewardId: next })}
          aria-label="Reward id"
        />
      </InspectorField>
    </Stack>
  );
}
