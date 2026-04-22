import { Input, InspectorField, Stack } from "@obs/design-system";
import type { TriggerMatcher } from "@obs/core";

type ChatCommandMatcher = Extract<TriggerMatcher, { type: "chat.command" }>;

interface ChatCommandEditorProps {
  matcher: ChatCommandMatcher;
  onChange: (patch: Partial<ChatCommandMatcher>) => void;
}

/**
 * Chat command matcher — case-insensitive startsWith match after trimming.
 * The leading `!` is a convention, not enforced; any prefix works.
 */
export function ChatCommandEditor({ matcher, onChange }: ChatCommandEditorProps) {
  return (
    <Stack gap={2}>
      <InspectorField label="Command" description="Matches as a prefix after trim">
        <Input
          value={matcher.command}
          onChange={(event) => onChange({ command: event.target.value })}
          placeholder="!hype"
          aria-label="Command"
        />
      </InspectorField>
    </Stack>
  );
}
