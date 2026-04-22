import { useEffect, useState } from "react";
import { resolveConfig, type OverlayConfig } from "./boot";
import { installHost } from "./host";
import { overlayBus } from "./bus";
import { Overlay } from "./renderer/Overlay";
import { canvasRenderer } from "./renderer/capabilities";

// Log the detected renderer path once on module load. Does NOT switch
// behavior — the DOM path is the only thing implemented today.
console.info("[overlay] renderer=", canvasRenderer ? "canvas-capable (flag on)" : "dom");

export function App() {
  const [config, setConfig] = useState<OverlayConfig | null>(() => resolveConfig());

  useEffect(() => {
    const cleanup = installHost({ setConfig, bus: overlayBus });
    return cleanup;
  }, []);

  if (!config) {
    return <div className="empty">Waiting for configuration…</div>;
  }

  return <Overlay project={config.project} bus={overlayBus} />;
}
