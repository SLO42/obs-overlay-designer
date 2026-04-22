import { useState } from "react";
import { AppShell } from "@obs/design-system";
import { Toolbar } from "./Toolbar";
import { LeftRail } from "./LeftRail";
import { Canvas } from "./canvas/Canvas";
import { Inspector } from "./inspector/Inspector";
import { PreviewPane } from "./preview/PreviewPane";

export type StageMode = "design" | "preview";

/**
 * Composes AppShell around the builder's four regions:
 *  - Toolbar (top), LeftRail (left), Canvas or PreviewPane (center),
 *    Inspector (right).
 *
 * Stage mode is local state here because it only affects what renders in
 * the center pane. Everything project-related still flows through the
 * zustand store (Task 3).
 */
export function Editor() {
  const [stage, setStage] = useState<StageMode>("design");

  return (
    <AppShell
      data-builder=""
      toolbar={<Toolbar stage={stage} onStageChange={setStage} />}
      left={<LeftRail />}
      right={<Inspector />}
    >
      {stage === "design" ? <Canvas /> : <PreviewPane />}
    </AppShell>
  );
}
