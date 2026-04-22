import { Input, InspectorField, NumberField, Stack } from "@obs/design-system";
import type { TriggerMatcher } from "@obs/core";

type DonationMatcher = Extract<TriggerMatcher, { type: "donation" }>;

interface DonationEditorProps {
  matcher: DonationMatcher;
  onChange: (patch: Partial<DonationMatcher>) => void;
}

/**
 * Donation matcher — optional minimum amount (in minor units) and
 * optional currency filter. Currency is a 3-char ISO code uppercased as
 * the user types; empty means "any".
 */
export function DonationEditor({ matcher, onChange }: DonationEditorProps) {
  return (
    <Stack gap={2}>
      <InspectorField label="Min amount" description="In minor units (cents)">
        <NumberField
          value={matcher.minAmount ?? 0}
          min={0}
          onChange={(next) => onChange({ minAmount: Math.max(0, Math.round(next)) })}
          aria-label="Minimum donation amount"
        />
      </InspectorField>
      <InspectorField label="Currency">
        <Input
          value={matcher.currency ?? ""}
          onChange={(event) =>
            onChange({
              currency:
                event.target.value.length === 0
                  ? undefined
                  : event.target.value.toUpperCase().slice(0, 3),
            })
          }
          maxLength={3}
          placeholder="USD"
          aria-label="Currency code"
          spellCheck={false}
        />
      </InspectorField>
    </Stack>
  );
}
