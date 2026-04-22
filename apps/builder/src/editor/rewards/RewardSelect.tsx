import { useEffect, useMemo, useState } from "react";
import { Input, Select, Stack } from "@obs/design-system";
import { useRewards } from "@obs/twitch";

interface RewardSelectProps {
  /** Current reward ID (may be empty). */
  value: string;
  onChange: (rewardId: string) => void;
  id?: string;
  /** `aria-label` when no external label is present. */
  "aria-label"?: string;
  /** Placeholder for the fallback text input. */
  placeholder?: string;
}

/** Sentinel used by the <Select> to switch into "custom id" mode. */
const CUSTOM_SENTINEL = "__custom__";

/**
 * Reward ID input that prefers a populated `<Select>` sourced from Helix
 * but gracefully degrades to a plain text `<Input>` when:
 *  - Twitch isn't connected yet.
 *  - The rewards list hasn't loaded / failed to load.
 *  - The current value is an ID not present in the fetched list (custom
 *    mode). Users keep a "Custom…" menu entry to re-enter the input.
 */
export function RewardSelect({
  value,
  onChange,
  id,
  "aria-label": ariaLabel = "Reward",
  placeholder = "reward-uuid",
}: RewardSelectProps) {
  const rewardsApi = useRewards();
  const rewards = rewardsApi.rewards;

  // Keep a local `custom` flag so typing a non-listed id doesn't nuke the
  // text the moment rewards reload (which would re-select the matching row).
  const [customMode, setCustomMode] = useState(false);

  const matchesListed = useMemo(
    () => !!rewards && rewards.some((r) => r.id === value),
    [rewards, value],
  );

  useEffect(() => {
    // If the list arrives and the value matches, exit custom mode.
    if (rewards && matchesListed) {
      setCustomMode(false);
    }
  }, [rewards, matchesListed]);

  // If we're not connected / rewards not loaded, fall back to a plain input.
  if (!rewardsApi.available || !rewards) {
    return (
      <Stack gap={1}>
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          spellCheck={false}
        />
        <span style={{ color: "var(--fg-muted)", fontSize: 11 }}>
          Connect Twitch to pick from your rewards.
        </span>
      </Stack>
    );
  }

  // Custom mode: user opted into free-form entry, or the current id isn't
  // in the list (likely pasted from Twitch dashboard / another app).
  if (customMode || (value && !matchesListed)) {
    return (
      <Stack gap={1}>
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => {
            setCustomMode(false);
            onChange("");
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--fg-secondary)",
            fontSize: 11,
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Pick from list instead
        </button>
      </Stack>
    );
  }

  const options = [
    ...rewards.map((r) => ({ value: r.id, label: `${r.title} · ${r.cost} pts` })),
    { value: CUSTOM_SENTINEL, label: "Custom…" },
  ];

  return (
    <Select
      id={id}
      value={value || (options[0]?.value ?? "")}
      onValueChange={(next) => {
        if (next === CUSTOM_SENTINEL) {
          setCustomMode(true);
          // Leave the current id intact — the user may type over it.
          return;
        }
        onChange(next);
      }}
      options={options}
      aria-label={ariaLabel}
    />
  );
}
