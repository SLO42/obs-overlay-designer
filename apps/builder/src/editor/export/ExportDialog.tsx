import { useEffect, useState, type ReactNode } from "react";
import { Button, Dialog, Panel, Stack } from "@obs/design-system";
import { useEditorStore } from "../../store";
import { buildOverlayHtml, downloadOverlayHtml, fetchTemplate, safeFilename } from "../../export";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Format a byte count as a human-readable "XXX kB" / "X.X MB" string. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Label/value row inside the summary panel. Mirrors the spec in Task 7. */
function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack
      direction="row"
      justify="space-between"
      align="baseline"
      gap={3}
      style={{ width: "100%" }}
    >
      <span style={{ color: "var(--fg-secondary)", fontSize: 13 }}>{label}</span>
      <span
        style={{
          color: "var(--fg-primary)",
          fontSize: 13,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </Stack>
  );
}

/**
 * Export screen. Wired to the Toolbar's Export button -- the user sees a
 * summary of what they're about to download and a one-click CTA. All real
 * work (fetching template, injecting config, triggering download) lives
 * in `../../export`; this component is just glue.
 */
export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const project = useEditorStore((s) => s.project);
  const canvas = project.canvas;
  const widgets = project.widgets;

  const [templateHtml, setTemplateHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the template as soon as the dialog opens. fetchTemplate() has
  // its own module-scoped cache, so reopening the dialog is cheap.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    fetchTemplate()
      .then((html) => {
        if (!cancelled) setTemplateHtml(html);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const templateBytesLabel = templateHtml
    ? formatBytes(new Blob([templateHtml]).size)
    : error
      ? "unavailable"
      : "loading…";

  const handleDownload = async () => {
    setError(null);
    setBusy(true);
    try {
      const tpl = templateHtml ?? (await fetchTemplate());
      if (!templateHtml) setTemplateHtml(tpl);
      const html = buildOverlayHtml({ project, templateHtml: tpl });
      const filename = `${safeFilename(project.meta.name)}.overlay.html`;
      downloadOverlayHtml(html, filename);
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} width={520}>
      <Dialog.Title>Export overlay</Dialog.Title>
      <Dialog.Description>
        Downloads a single HTML file you drop into OBS as a <strong>Browser Source</strong>
        &nbsp;(Local file).
      </Dialog.Description>
      <Dialog.Body>
        <Stack gap={3}>
          <Panel tone="nested" padding={4}>
            <Stack gap={2}>
              <Row label="Project" value={project.meta.name} />
              <Row label="Canvas" value={`${canvas.width} × ${canvas.height}`} />
              <Row label="Widgets" value={`${widgets.length}`} />
              <Row label="Size est." value={templateBytesLabel} />
            </Stack>
          </Panel>

          <Panel tone="nested" padding={4}>
            <ol
              style={{
                margin: 0,
                paddingLeft: 20,
                color: "var(--fg-secondary)",
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              <li>
                In OBS, add a <strong>Browser Source</strong>.
              </li>
              <li>
                Check <strong>Local file</strong> and pick the downloaded file.
              </li>
              <li>
                Set width <strong>{canvas.width}</strong> × height <strong>{canvas.height}</strong>.
              </li>
              <li>
                Uncheck <strong>Shutdown source when not visible</strong> so the overlay stays
                connected.
              </li>
              <li>
                Toggle <strong>Refresh browser when scene becomes active</strong> if you update
                settings between scenes.
              </li>
            </ol>
          </Panel>

          {error ? (
            <p role="alert" style={{ color: "var(--c-danger-500)", margin: 0, fontSize: 13 }}>
              {error}
            </p>
          ) : null}
        </Stack>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleDownload}
          disabled={busy || (!templateHtml && !error)}
        >
          {busy ? "Building…" : "Download overlay.html"}
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
