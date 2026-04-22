import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  ColorInput,
  Dialog,
  Icon,
  IconButton,
  Input,
  InspectorField,
  Menu,
  NumberField,
  Panel,
  ScrollArea,
  Stack,
  Switch,
  Tooltip,
} from "@obs/design-system";
import {
  clearStoredToken,
  useRewards,
  type CreateRewardBody,
  type CustomReward,
  type UpdateRewardBody,
} from "@obs/twitch";
import { useTwitchContext } from "../twitch/TwitchProvider";
import { ConnectDialog } from "../twitch/ConnectDialog";

interface RewardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FormState = {
  title: string;
  cost: number;
  prompt: string;
  isEnabled: boolean;
  isUserInputRequired: boolean;
  backgroundColor: string;
  globalCooldownSeconds: number;
  maxPerStream: number;
  maxPerUserPerStream: number;
};

/** Fresh defaults shown in the create form. */
function emptyForm(): FormState {
  return {
    title: "",
    cost: 100,
    prompt: "",
    isEnabled: true,
    isUserInputRequired: false,
    backgroundColor: "#9147ff",
    globalCooldownSeconds: 0,
    maxPerStream: 0,
    maxPerUserPerStream: 0,
  };
}

/** Hydrate the form from an existing reward so the edit pane is pre-filled. */
function formFromReward(r: CustomReward): FormState {
  return {
    title: r.title,
    cost: r.cost,
    prompt: r.prompt,
    isEnabled: r.isEnabled,
    isUserInputRequired: r.isUserInputRequired,
    backgroundColor: normalizeHex6(r.backgroundColor) || "#9147ff",
    globalCooldownSeconds: r.globalCooldownSeconds ?? 0,
    maxPerStream: r.maxPerStream ?? 0,
    maxPerUserPerStream: r.maxPerUserPerStream ?? 0,
  };
}

/** Twitch's API returns colors in multiple formats — clamp to #rrggbb. */
function normalizeHex6(input: string): string | null {
  const match = /^#([0-9a-f]{6})$/i.exec(input);
  if (!match) return null;
  return `#${match[1]!.toLowerCase()}`;
}

type SelectedPane = { kind: "none" } | { kind: "create" } | { kind: "edit"; id: string };

/**
 * Builder-side CRUD UI for the broadcaster's channel-point rewards. Uses
 * `useRewards()` — a `null` return from that hook means "not connected"
 * or "scope missing"; we differentiate via the hook's `available` /
 * `canManage` flags.
 */
export function RewardsDialog({ open, onOpenChange }: RewardsDialogProps) {
  const { connection } = useTwitchContext();
  const rewardsApi = useRewards();
  const [connectOpen, setConnectOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedPane>({ kind: "none" });
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Reset local form state whenever the dialog opens/closes so we don't
  // leak stale data across opens.
  useEffect(() => {
    if (!open) {
      setSelected({ kind: "none" });
      setForm(emptyForm());
      setMutationError(null);
    }
  }, [open]);

  // Keep the form in sync with the currently-selected reward.
  const selectedReward = useMemo<CustomReward | null>(() => {
    if (selected.kind !== "edit") return null;
    return rewardsApi.rewards?.find((r) => r.id === selected.id) ?? null;
  }, [selected, rewardsApi.rewards]);

  useEffect(() => {
    if (selected.kind === "edit" && selectedReward) {
      setForm(formFromReward(selectedReward));
      setMutationError(null);
    } else if (selected.kind === "create") {
      setForm(emptyForm());
      setMutationError(null);
    }
  }, [selected, selectedReward]);

  const twitchStatus = connection.status;
  const notConnected = twitchStatus !== "active" || !rewardsApi.available;
  const missingManageScope = rewardsApi.available && !rewardsApi.canManage;

  const handleReconnect = () => {
    // Clear the stored token so the next connect triggers a fresh popup
    // with DEFAULT_SCOPES (which now includes channel:manage:redemptions).
    clearStoredToken();
    connection.disconnect();
    setConnectOpen(true);
  };

  const handleSave = async () => {
    setSubmitting(true);
    setMutationError(null);
    try {
      if (selected.kind === "create") {
        const body: CreateRewardBody = {
          title: form.title.trim(),
          cost: Math.max(1, Math.floor(form.cost)),
          prompt: form.prompt,
          isEnabled: form.isEnabled,
          isUserInputRequired: form.isUserInputRequired,
          backgroundColor: form.backgroundColor,
          globalCooldownSeconds: Math.max(0, Math.floor(form.globalCooldownSeconds)),
          maxPerStream: Math.max(0, Math.floor(form.maxPerStream)),
          maxPerUserPerStream: Math.max(0, Math.floor(form.maxPerUserPerStream)),
        };
        const created = await rewardsApi.create(body);
        setSelected({ kind: "edit", id: created.id });
      } else if (selected.kind === "edit") {
        const body: UpdateRewardBody = {
          title: form.title.trim(),
          cost: Math.max(1, Math.floor(form.cost)),
          prompt: form.prompt,
          isEnabled: form.isEnabled,
          isUserInputRequired: form.isUserInputRequired,
          backgroundColor: form.backgroundColor,
          globalCooldownSeconds: Math.max(0, Math.floor(form.globalCooldownSeconds)),
          maxPerStream: Math.max(0, Math.floor(form.maxPerStream)),
          maxPerUserPerStream: Math.max(0, Math.floor(form.maxPerUserPerStream)),
        };
        await rewardsApi.update(selected.id, body);
      }
    } catch (err) {
      setMutationError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reward: CustomReward) => {
    setSubmitting(true);
    setMutationError(null);
    try {
      await rewardsApi.remove(reward.id);
      if (selected.kind === "edit" && selected.id === reward.id) {
        setSelected({ kind: "none" });
      }
    } catch (err) {
      setMutationError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePaused = async (reward: CustomReward) => {
    setSubmitting(true);
    setMutationError(null);
    try {
      await rewardsApi.update(reward.id, { isPaused: !reward.isPaused });
    } catch (err) {
      setMutationError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEnabled = async (reward: CustomReward) => {
    setSubmitting(true);
    setMutationError(null);
    try {
      await rewardsApi.update(reward.id, { isEnabled: !reward.isEnabled });
    } catch (err) {
      setMutationError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} width={820}>
        <Dialog.Title>Channel-point rewards</Dialog.Title>
        <Dialog.Description>
          Manage custom channel-point rewards on your channel. Only rewards created through this app
          can be edited or deleted — rewards from the Twitch dashboard are shown read-only.
        </Dialog.Description>
        <Dialog.Body>
          {notConnected ? (
            <NotConnectedState onConnect={() => setConnectOpen(true)} />
          ) : missingManageScope ? (
            <MissingScopeState onReconnect={handleReconnect} />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "280px 1fr",
                gap: "var(--space-3)",
                maxHeight: "70vh",
              }}
            >
              <RewardList
                rewards={rewardsApi.rewards}
                loading={rewardsApi.loading}
                error={rewardsApi.error}
                selectedId={selected.kind === "edit" ? selected.id : null}
                onSelect={(id) => setSelected({ kind: "edit", id })}
                onCreate={() => setSelected({ kind: "create" })}
                onReload={() => void rewardsApi.reload()}
                onToggleEnabled={(r) => void handleToggleEnabled(r)}
                onTogglePaused={(r) => void handleTogglePaused(r)}
                onDelete={(r) => void handleDelete(r)}
                submitting={submitting}
              />
              <EditPane
                mode={selected.kind}
                selectedReward={selectedReward}
                form={form}
                setForm={setForm}
                onSave={() => void handleSave()}
                onDelete={() => (selectedReward ? void handleDelete(selectedReward) : undefined)}
                submitting={submitting}
                error={mutationError}
              />
            </div>
          )}
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </Dialog.Footer>
      </Dialog>
      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </>
  );
}

function NotConnectedState({ onConnect }: { onConnect: () => void }) {
  return (
    <Panel tone="nested" padding={5}>
      <Stack gap={3} align="center">
        <Icon name="Radio" size={32} />
        <p style={{ margin: 0, color: "var(--fg-secondary)" }}>
          Connect to Twitch to manage rewards.
        </p>
        <Button variant="primary" onClick={onConnect}>
          Connect Twitch
        </Button>
      </Stack>
    </Panel>
  );
}

function MissingScopeState({ onReconnect }: { onReconnect: () => void }) {
  return (
    <Panel tone="nested" padding={5}>
      <Stack gap={3} align="center">
        <Icon name="KeyRound" size={32} />
        <p style={{ margin: 0, color: "var(--fg-secondary)" }}>
          Reconnect with extended permissions to manage rewards. The{" "}
          <code>channel:manage:redemptions</code> scope is required for create / update / delete
          operations.
        </p>
        <Button variant="primary" onClick={onReconnect}>
          Reconnect
        </Button>
      </Stack>
    </Panel>
  );
}

interface RewardListProps {
  rewards: CustomReward[] | null;
  loading: boolean;
  error: Error | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onReload: () => void;
  onToggleEnabled: (r: CustomReward) => void;
  onTogglePaused: (r: CustomReward) => void;
  onDelete: (r: CustomReward) => void;
  submitting: boolean;
}

function RewardList(props: RewardListProps) {
  const {
    rewards,
    loading,
    error,
    selectedId,
    onSelect,
    onCreate,
    onReload,
    onToggleEnabled,
    onTogglePaused,
    onDelete,
    submitting,
  } = props;
  return (
    <Panel tone="nested" padding={3} style={{ overflow: "hidden" }}>
      <Stack gap={2} style={{ height: "100%", minHeight: 300 }}>
        <Stack direction="row" gap={2} align="center" justify="space-between">
          <Button
            size="sm"
            variant="primary"
            leading={<Icon name="Plus" size={12} />}
            onClick={onCreate}
          >
            Create reward
          </Button>
          <Tooltip content="Reload">
            <IconButton aria-label="Reload rewards" onClick={onReload} disabled={submitting}>
              <Icon name="RefreshCw" size={14} />
            </IconButton>
          </Tooltip>
        </Stack>
        {error ? (
          <p role="alert" style={{ color: "var(--c-danger-500)", margin: 0, fontSize: 12 }}>
            {error.message}
          </p>
        ) : null}
        {loading && !rewards ? (
          <p style={{ color: "var(--fg-secondary)", fontSize: 12 }}>Loading rewards…</p>
        ) : null}
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          <Stack gap={1}>
            {(rewards ?? []).length === 0 && !loading ? (
              <p style={{ color: "var(--fg-secondary)", fontSize: 12 }}>
                No rewards yet. Click “Create reward” to add one.
              </p>
            ) : null}
            {(rewards ?? []).map((reward) => (
              <RewardRow
                key={reward.id}
                reward={reward}
                selected={reward.id === selectedId}
                onSelect={() => onSelect(reward.id)}
                onToggleEnabled={() => onToggleEnabled(reward)}
                onTogglePaused={() => onTogglePaused(reward)}
                onDelete={() => onDelete(reward)}
              />
            ))}
          </Stack>
        </ScrollArea>
      </Stack>
    </Panel>
  );
}

function RewardRow({
  reward,
  selected,
  onSelect,
  onToggleEnabled,
  onTogglePaused,
  onDelete,
}: {
  reward: CustomReward;
  selected: boolean;
  onSelect: () => void;
  onToggleEnabled: () => void;
  onTogglePaused: () => void;
  onDelete: () => void;
}) {
  const readOnly = !reward.ownedByApp;
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`reward-row-${reward.id}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-2)",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        background: selected ? "var(--surface-raised)" : "transparent",
        border: `1px solid ${selected ? "var(--border-strong)" : "transparent"}`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          background: reward.backgroundColor || "transparent",
          border: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      />
      <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={reward.title}
        >
          {reward.title}
        </span>
        <Stack direction="row" gap={1} align="center">
          <span style={{ color: "var(--fg-secondary)", fontSize: 11 }}>{reward.cost} pts</span>
          {reward.isEnabled ? <Badge variant="ok">On</Badge> : <Badge variant="neutral">Off</Badge>}
          {reward.isPaused ? <Badge variant="warn">Paused</Badge> : null}
          {readOnly ? (
            <Tooltip content="Only rewards created by this app can be updated or deleted.">
              <Badge variant="neutral">Read-only</Badge>
            </Tooltip>
          ) : null}
        </Stack>
      </Stack>
      <Menu
        trigger={
          <IconButton
            aria-label={`Actions for ${reward.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="MoreHorizontal" size={14} />
          </IconButton>
        }
      >
        <Menu.Item
          onSelect={() => {
            onSelect();
          }}
          disabled={readOnly}
        >
          Edit
        </Menu.Item>
        <Menu.Item onSelect={onToggleEnabled} disabled={readOnly}>
          {reward.isEnabled ? "Disable" : "Enable"}
        </Menu.Item>
        <Menu.Item onSelect={onTogglePaused} disabled={readOnly}>
          {reward.isPaused ? "Resume" : "Pause"}
        </Menu.Item>
        <Menu.Separator />
        <Menu.Item onSelect={onDelete} disabled={readOnly}>
          Delete
        </Menu.Item>
      </Menu>
    </div>
  );
}

interface EditPaneProps {
  mode: "none" | "create" | "edit";
  selectedReward: CustomReward | null;
  form: FormState;
  setForm: (patch: FormState) => void;
  onSave: () => void;
  onDelete: () => void;
  submitting: boolean;
  error: string | null;
}

function EditPane({
  mode,
  selectedReward,
  form,
  setForm,
  onSave,
  onDelete,
  submitting,
  error,
}: EditPaneProps) {
  if (mode === "none") {
    return (
      <Panel tone="nested" padding={4}>
        <Stack gap={2} align="center" style={{ padding: "var(--space-4)" }}>
          <Icon name="Gift" size={28} />
          <p style={{ margin: 0, color: "var(--fg-secondary)", fontSize: 13 }}>
            Select a reward on the left, or click “Create reward” to add a new one.
          </p>
        </Stack>
      </Panel>
    );
  }

  const readOnly = mode === "edit" && selectedReward && !selectedReward.ownedByApp;

  const patch = (partial: Partial<FormState>) => setForm({ ...form, ...partial });

  return (
    <Panel tone="nested" padding={4}>
      <ScrollArea style={{ maxHeight: "calc(70vh - 140px)" }}>
        <Stack gap={3}>
          {readOnly ? (
            <Panel tone="default" padding={2}>
              <Stack direction="row" gap={2} align="center">
                <Icon name="Lock" size={14} />
                <span style={{ fontSize: 12, color: "var(--fg-secondary)" }}>
                  This reward belongs to another app — it can only be read.
                </span>
              </Stack>
            </Panel>
          ) : null}
          <InspectorField label="Title" htmlFor="reward-title">
            <Input
              id="reward-title"
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="My reward"
              disabled={!!readOnly}
            />
          </InspectorField>
          <InspectorField label="Cost" htmlFor="reward-cost" description="Must be at least 1.">
            <NumberField
              id="reward-cost"
              value={form.cost}
              min={1}
              onChange={(next) => patch({ cost: Math.max(1, Math.floor(next)) })}
              disabled={!!readOnly}
            />
          </InspectorField>
          <InspectorField label="Prompt" htmlFor="reward-prompt">
            <Input
              id="reward-prompt"
              value={form.prompt}
              onChange={(e) => patch({ prompt: e.target.value })}
              placeholder="Optional prompt shown to viewers"
              disabled={!!readOnly}
            />
          </InspectorField>
          <InspectorField label="Enabled" htmlFor="reward-enabled">
            <Switch
              aria-label="Enabled"
              checked={form.isEnabled}
              onChange={(next) => patch({ isEnabled: next })}
              disabled={!!readOnly}
            />
          </InspectorField>
          <InspectorField label="User input required" htmlFor="reward-input">
            <Switch
              aria-label="User input required"
              checked={form.isUserInputRequired}
              onChange={(next) => patch({ isUserInputRequired: next })}
              disabled={!!readOnly}
            />
          </InspectorField>
          <InspectorField label="Background color" htmlFor="reward-color">
            <ColorInput
              id="reward-color"
              value={form.backgroundColor}
              onChange={(next) => patch({ backgroundColor: next })}
              disabled={!!readOnly}
            />
          </InspectorField>
          <InspectorField
            label="Global cooldown (seconds)"
            htmlFor="reward-cooldown"
            description="0 disables the cooldown."
          >
            <NumberField
              id="reward-cooldown"
              value={form.globalCooldownSeconds}
              min={0}
              onChange={(next) => patch({ globalCooldownSeconds: Math.max(0, Math.floor(next)) })}
              disabled={!!readOnly}
            />
          </InspectorField>
          <InspectorField
            label="Max per stream"
            htmlFor="reward-maxstream"
            description="0 = unlimited."
          >
            <NumberField
              id="reward-maxstream"
              value={form.maxPerStream}
              min={0}
              onChange={(next) => patch({ maxPerStream: Math.max(0, Math.floor(next)) })}
              disabled={!!readOnly}
            />
          </InspectorField>
          <InspectorField
            label="Max per user per stream"
            htmlFor="reward-maxuser"
            description="0 = unlimited."
          >
            <NumberField
              id="reward-maxuser"
              value={form.maxPerUserPerStream}
              min={0}
              onChange={(next) => patch({ maxPerUserPerStream: Math.max(0, Math.floor(next)) })}
              disabled={!!readOnly}
            />
          </InspectorField>
          {error ? (
            <p role="alert" style={{ color: "var(--c-danger-500)", margin: 0, fontSize: 12 }}>
              {error}
            </p>
          ) : null}
          <Stack direction="row" gap={2} justify="flex-end">
            {mode === "edit" && !readOnly ? (
              <Button variant="danger" onClick={onDelete} disabled={submitting}>
                Delete
              </Button>
            ) : null}
            <Button variant="primary" onClick={onSave} disabled={submitting || !!readOnly}>
              {submitting ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
          </Stack>
        </Stack>
      </ScrollArea>
    </Panel>
  );
}
