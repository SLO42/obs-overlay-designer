import { useEffect, useState } from "react";
import { TwitchConnection } from "@obs/twitch";
import { resolveConfig, type OverlayConfig } from "./boot";
import { installHost } from "./host";
import { overlayBus } from "./bus";
import { Overlay } from "./renderer/Overlay";
import { canvasRenderer } from "./renderer/capabilities";
import { startTipSubscription } from "./tipBoot";

// Log the detected renderer path once on module load. Does NOT switch
// behavior — the DOM path is the only thing implemented today.
console.info("[overlay] renderer=", canvasRenderer ? "canvas-capable (flag on)" : "dom");

/**
 * Minimum payload we need from the embedded config to attempt an
 * auto-connect. Anything missing → silent skip (overlay still renders
 * static widgets; the builder's preview is the expected entry point).
 */
function twitchAutoConnectFrom(config: OverlayConfig | null): {
  clientId: string;
  accessToken: string;
  channelLogin: string;
} | null {
  const t = config?.twitch;
  if (!t) return null;
  if (!t.clientId || !t.accessToken || !t.channelLogin) return null;
  return {
    clientId: t.clientId,
    accessToken: t.accessToken,
    channelLogin: t.channelLogin,
  };
}

export function App() {
  const [config, setConfig] = useState<OverlayConfig | null>(() => resolveConfig());

  useEffect(() => {
    const cleanup = installHost({ setConfig, bus: overlayBus });
    return cleanup;
  }, []);

  // Auto-connect EventSub when the exported overlay carries a stamped
  // token. Runs once per config change — if the embedded config is
  // replaced at runtime (host postMessage), we tear down the old socket
  // and open a new one for the new token.
  useEffect(() => {
    const auto = twitchAutoConnectFrom(config);
    if (!auto) return;

    const connection = new TwitchConnection({ clientId: auto.clientId });

    const offEvent = connection.onEvent((event) => overlayBus.emit(event));
    const offErr = connection.onError((err) =>
      console.error("[overlay] twitch connection error", err),
    );

    let cancelled = false;
    (async () => {
      const seeded = await connection.seedToken(auto.accessToken);
      if (cancelled) return;
      if (!seeded) {
        console.error("[overlay] twitch token failed validation; skipping auto-connect");
        return;
      }
      try {
        await connection.connect({
          channelLogin: auto.channelLogin,
          subscribe: [
            "channel.chat.message",
            "channel.cheer",
            "channel.subscribe",
            "channel.subscription.gift",
            "channel.follow",
            "channel.raid",
            "channel.channel_points_custom_reward_redemption.add",
          ],
        });
      } catch (err) {
        console.error("[overlay] twitch auto-connect failed", err);
      }
    })();

    return () => {
      cancelled = true;
      offEvent();
      offErr();
      connection.disconnect();
    };
  }, [config]);

  // Auto-subscribe to the StreamTeam tip channel when the embedded config
  // carries a slug + supabase url/key. Incoming broadcasts fan out on the
  // shared `overlayBus` as `DonationEvent`s so the SpeakAlert widget and
  // any future donation ticker pick them up through the same kind-filtered
  // subscription they already use for Twitch cheers.
  useEffect(() => {
    const cleanup = startTipSubscription(config, overlayBus);
    return () => {
      cleanup?.();
    };
  }, [config]);

  if (!config) {
    return <div className="empty">Waiting for configuration…</div>;
  }

  return <Overlay project={config.project} bus={overlayBus} />;
}
