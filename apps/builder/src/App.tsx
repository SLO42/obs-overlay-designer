import { Editor } from "./editor/Editor";
import { KeyboardShortcuts } from "./editor/KeyboardShortcuts";

/**
 * Root of the builder SPA. Thin wrapper: the editor chrome lives in
 * `./editor/Editor` and keyboard shortcuts are registered once at the
 * root so they work regardless of which pane has focus.
 */
export function App() {
  return (
    <>
      <Editor />
      <KeyboardShortcuts />
    </>
  );
}
