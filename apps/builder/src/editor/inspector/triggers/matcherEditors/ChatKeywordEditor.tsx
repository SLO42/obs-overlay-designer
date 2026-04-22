import { Checkbox, Input, InspectorField, Stack, Switch } from "@obs/design-system";
import type { TriggerMatcher } from "@obs/core";

type ChatKeywordMatcher = Extract<TriggerMatcher, { type: "chat.keyword" }>;
type ChatRole = NonNullable<ChatKeywordMatcher["roles"]>[number];

interface ChatKeywordEditorProps {
  matcher: ChatKeywordMatcher;
  onChange: (patch: Partial<ChatKeywordMatcher>) => void;
}

const ALL_ROLES: Array<{ value: ChatRole; label: string }> = [
  { value: "viewer", label: "Viewer" },
  { value: "subscriber", label: "Subscriber" },
  { value: "vip", label: "VIP" },
  { value: "mod", label: "Mod" },
  { value: "broadcaster", label: "Broadcaster" },
];

/**
 * Chat keyword matcher — substring match against `ChatMessage.plain`. The
 * empty keyword never matches (engine contract), so we leave the field
 * required-in-practice via label; no client-side validation blocks input.
 */
export function ChatKeywordEditor({ matcher, onChange }: ChatKeywordEditorProps) {
  const roles = matcher.roles ?? [];
  const toggleRole = (role: ChatRole) => {
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    onChange({ roles: next });
  };

  return (
    <Stack gap={2}>
      <InspectorField label="Keyword">
        <Input
          value={matcher.keyword}
          onChange={(event) => onChange({ keyword: event.target.value })}
          placeholder="hype"
          aria-label="Keyword"
        />
      </InspectorField>
      <InspectorField label="Case sensitive">
        <Switch
          checked={matcher.caseSensitive ?? false}
          onChange={(next) => onChange({ caseSensitive: next })}
          aria-label="Case sensitive match"
        />
      </InspectorField>
      <InspectorField
        label="Roles"
        description={
          roles.length === 0 ? "Any user role matches" : "User must have at least one role"
        }
      >
        <Stack gap={1}>
          {ALL_ROLES.map((r) => {
            const checked = roles.includes(r.value);
            return (
              <label
                key={r.value}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "var(--fg-body)",
                }}
              >
                <Checkbox
                  checked={checked}
                  onChange={() => toggleRole(r.value)}
                  aria-label={`Role: ${r.label}`}
                />
                <span>{r.label}</span>
              </label>
            );
          })}
        </Stack>
      </InspectorField>
    </Stack>
  );
}
