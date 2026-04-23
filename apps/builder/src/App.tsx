import { useEffect, useState } from "react";
import { consumeRedirect } from "@obs/twitch";
import { Editor } from "./editor/Editor";
import { KeyboardShortcuts } from "./editor/KeyboardShortcuts";
import { TwitchProvider } from "./editor/twitch/TwitchProvider";
import { TipsProvider } from "./editor/tips/TipsProvider";

/**
 * Minimal callback page rendered at `/twitch/callback`. It runs
 * `consumeRedirect()` — which extracts the token from the URL fragment,
 * postMessages it back to the builder window, and closes itself.
 *
 * If the window didn't close (e.g. the user opened the link directly
 * instead of through the OAuth popup), we show a small receipt so they
 * can close the tab manually.
 */
function TwitchCallback() {
  const [message, setMessage] = useState("Completing sign-in…");
  useEffect(() => {
    const result = consumeRedirect();
    setMessage(
      result ? "Signed in. You can close this window." : "No Twitch token found in this URL.",
    );
  }, []);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "var(--font-sans, system-ui)",
        color: "var(--fg-primary, #222)",
      }}
    >
      {message}
    </div>
  );
}

/**
 * Root of the builder SPA. The `/twitch/callback` path short-circuits
 * into a minimal auth receiver; every other path renders the editor
 * wrapped in the TwitchProvider so the Connect button + Live badge
 * always have access to the shared connection.
 */
export function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/twitch/callback") {
    return <TwitchCallback />;
  }
  return (
    <TwitchProvider>
      <TipsProvider>
        <Editor />
        <KeyboardShortcuts />
      </TipsProvider>
    </TwitchProvider>
  );
}
