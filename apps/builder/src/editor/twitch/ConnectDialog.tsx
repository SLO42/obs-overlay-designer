import { useEffect, useState } from "react";
import { Badge, Button, Dialog, Input, Panel, Stack } from "@obs/design-system";
import { DEFAULT_SCOPES, type ConnectionStatus, type EventSubType } from "@obs/twitch";
import { useTwitchContext } from "./TwitchProvider";

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Subscription types we request by default when the user clicks Connect. */
const DEFAULT_SUBSCRIBE: EventSubType[] = [
  "channel.chat.message",
  "channel.cheer",
  "channel.subscribe",
  "channel.subscription.gift",
  "channel.follow",
  "channel.raid",
  "channel.channel_points_custom_reward_redemption.add",
];

/**
 * Dialog surfaced from the Toolbar's Connect button (and the Fire-Event
 * menu's "Connect Twitch…" shortcut). Exposes the scopes we're about to
 * request, lets the user pick which channel to watch, and spawns the
 * OAuth popup via TwitchConnection.connect(). Status + errors bubble up
 * from the connection's listeners.
 */
export function ConnectDialog({ open, onOpenChange }: ConnectDialogProps) {
  const { connection } = useTwitchContext();

  const [status, setStatus] = useState<ConnectionStatus>(connection.status);
  const [selfLogin, setSelfLogin] = useState<string | null>(connection.userLogin);
  const [channelLogin, setChannelLogin] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // Mirror the connection's state into React whenever the dialog's open.
  useEffect(() => {
    if (!open) return;
    const offStatus = connection.onStatusChange((s) => {
      setStatus(s);
      setSelfLogin(connection.userLogin);
    });
    const offError = connection.onError((err) => setError(err.message));
    // Seed initial values.
    setStatus(connection.status);
    setSelfLogin(connection.userLogin);
    return () => {
      offStatus();
      offError();
    };
  }, [open, connection]);

  // When a login becomes known, pre-fill the channel input with the user's
  // own login the first time the dialog opens with no value.
  useEffect(() => {
    if (selfLogin && channelLogin === "") {
      setChannelLogin(selfLogin);
    }
  }, [selfLogin, channelLogin]);

  const handleConnect = async () => {
    setError(null);
    setWorking(true);
    try {
      await connection.connect({
        channelLogin: channelLogin.trim() || undefined,
        subscribe: DEFAULT_SUBSCRIBE,
      });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const handleDisconnect = () => {
    connection.disconnect();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} width={520}>
      <Dialog.Title>Connect Twitch</Dialog.Title>
      <Dialog.Description>
        Authorizes the builder + overlay to read chat, cheers, subs, follows, raids, and channel
        point redemptions for the channel below. Opens a popup to Twitch — complete the flow there,
        and the popup will close automatically.
      </Dialog.Description>
      <Dialog.Body>
        <Stack gap={3}>
          <Panel tone="nested" padding={4}>
            <Stack gap={2}>
              <span style={{ color: "var(--fg-secondary)", fontSize: 12, fontWeight: 600 }}>
                Scopes
              </span>
              <Stack direction="row" gap={1} wrap>
                {DEFAULT_SCOPES.map((scope) => (
                  <Badge key={scope} variant="neutral">
                    {scope}
                  </Badge>
                ))}
              </Stack>
            </Stack>
          </Panel>

          <Stack gap={1}>
            <label
              htmlFor="twitch-channel-login"
              style={{ color: "var(--fg-secondary)", fontSize: 12, fontWeight: 600 }}
            >
              Channel login
            </label>
            <Input
              id="twitch-channel-login"
              size="sm"
              value={channelLogin}
              onChange={(e) => setChannelLogin(e.target.value)}
              placeholder={selfLogin ?? "your_channel"}
            />
          </Stack>

          <Panel tone="nested" padding={3}>
            <Stack direction="row" justify="space-between" align="center">
              <span style={{ fontSize: 13 }}>Status</span>
              <StatusBadge status={status} login={selfLogin} />
            </Stack>
          </Panel>

          {error ? (
            <p role="alert" style={{ color: "var(--c-danger-500)", margin: 0, fontSize: 13 }}>
              {error}
            </p>
          ) : null}
        </Stack>
      </Dialog.Body>
      <Dialog.Footer>
        {status === "active" || status === "reconnecting" ? (
          <Button variant="ghost" onClick={handleDisconnect}>
            Disconnect
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        )}
        <Button variant="primary" onClick={handleConnect} disabled={working || status === "active"}>
          {status === "active" ? "Connected" : working ? "Connecting…" : "Connect"}
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}

function StatusBadge({ status, login }: { status: ConnectionStatus; login: string | null }) {
  switch (status) {
    case "active":
      return <Badge variant="ok">Live{login ? ` · @${login}` : ""}</Badge>;
    case "authenticating":
      return <Badge variant="info">Authenticating…</Badge>;
    case "validating":
      return <Badge variant="info">Validating token…</Badge>;
    case "connecting":
      return <Badge variant="info">Connecting…</Badge>;
    case "reconnecting":
      return <Badge variant="warn">Reconnecting…</Badge>;
    case "error":
      return <Badge variant="danger">EventSub error</Badge>;
    default:
      return <Badge variant="neutral">Not connected</Badge>;
  }
}
