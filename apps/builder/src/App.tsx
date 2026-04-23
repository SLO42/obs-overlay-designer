import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { consumeRedirect } from "@obs/twitch";
import { Editor } from "./editor/Editor";
import { KeyboardShortcuts } from "./editor/KeyboardShortcuts";
import { TwitchProvider } from "./editor/twitch/TwitchProvider";
import { TipsProvider } from "./editor/tips/TipsProvider";
import { TipRoute } from "./routes/tip/TipRoute";

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
 * The editor surface — everything the streamer sees in Design / Preview
 * mode. This is split out from the root `App` so react-router-dom can mount
 * it at `/` without also mounting the TipRoute's providers. The federation
 * remote still exposes `./Editor` directly (see `vite.config.ts`), so hosts
 * embedding the builder as a remote module never go through the router.
 */
function EditorRoute() {
  return (
    <TwitchProvider>
      <TipsProvider>
        <Editor />
        <KeyboardShortcuts />
      </TipsProvider>
    </TwitchProvider>
  );
}

/**
 * Root of the builder SPA. The `/twitch/callback` path short-circuits
 * into a minimal auth receiver before we mount the router — that popup
 * page only needs to read the URL fragment and close itself, so routing
 * would be overkill. Every other path goes through react-router-dom:
 *
 *   /           → editor (with Twitch + Tips providers)
 *   /tip/:slug  → public tip page (no providers, no auth)
 *   *           → redirect to /
 *
 * Vercel's `vercel.json` rewrites every non-asset path to `/index.html`,
 * so the SPA boots at any URL and the router takes over.
 */
export function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/twitch/callback") {
    return <TwitchCallback />;
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EditorRoute />} />
        <Route path="/tip/:slug" element={<TipRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
