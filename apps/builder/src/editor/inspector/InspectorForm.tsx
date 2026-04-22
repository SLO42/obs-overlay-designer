import { InspectorField, NumberField, Stack } from "@obs/design-system";
import type { Widget } from "@obs/core";
import { CanvasWidgetsProvider, getWidget } from "@obs/widgets";
import { useEditorStore } from "../../store";
import { ZodRenderer } from "./ZodRenderer";
import styles from "./Inspector.module.css";

interface InspectorFormProps {
  widget: Widget;
}

/**
 * Sets a nested value inside a plain object by path, cloning only the
 * spine so sibling values stay referentially stable. Used to apply
 * `onChange(path, next)` callbacks from the ZodRenderer back into the
 * widget's props record.
 */
function setAtPath(
  source: Record<string, unknown>,
  path: string[],
  next: unknown,
): Record<string, unknown> {
  if (path.length === 0) return source;
  const [head, ...rest] = path;
  const copy = { ...source };
  if (rest.length === 0) {
    copy[head!] = next;
  } else {
    const child = source[head!];
    copy[head!] = setAtPath(
      (child && typeof child === "object" ? child : {}) as Record<string, unknown>,
      rest,
      next,
    );
  }
  return copy;
}

/**
 * Inspector Style tab body. Shows widget geometry (x/y/w/h) on top and
 * the widget's properties form below. The form is `def.Inspector` when a
 * widget registers a custom one, or the auto-generated `ZodRenderer`
 * fallback when it doesn't.
 */
export function InspectorForm({ widget }: InspectorFormProps) {
  const def = getWidget(widget.kind);
  const updateTransform = useEditorStore((s) => s.updateTransform);
  const updateProps = useEditorStore((s) => s.updateProps);
  const projectWidgets = useEditorStore((s) => s.project.widgets);

  if (!def) {
    return <div className={styles.unsupported}>Unknown widget kind: {widget.kind}</div>;
  }

  const handlePropChange = (path: string[], next: unknown) => {
    const current = widget.props as Record<string, unknown>;
    const patched = setAtPath(current, path, next);
    // Shallow merge: only the top-level key of `path` actually needs
    // replacement because setAtPath cloned down the spine for us.
    const topKey = path[0]!;
    updateProps(widget.id, { [topKey]: patched[topKey] });
  };

  const CustomInspector = def.Inspector;

  return (
    <Stack gap={3}>
      <div>
        <div className={styles.sectionTitle}>Geometry</div>
        <Stack gap={2}>
          <InspectorField label="Position">
            <div className={styles.xy}>
              <NumberField
                value={widget.transform.x}
                onChange={(next) => updateTransform(widget.id, { x: Math.round(next) })}
                aria-label="x"
              />
              <NumberField
                value={widget.transform.y}
                onChange={(next) => updateTransform(widget.id, { y: Math.round(next) })}
                aria-label="y"
              />
            </div>
          </InspectorField>
          <InspectorField label="Size">
            <div className={styles.xy}>
              <NumberField
                value={widget.transform.w}
                min={8}
                onChange={(next) =>
                  updateTransform(widget.id, { w: Math.max(8, Math.round(next)) })
                }
                aria-label="width"
              />
              <NumberField
                value={widget.transform.h}
                min={8}
                onChange={(next) =>
                  updateTransform(widget.id, { h: Math.max(8, Math.round(next)) })
                }
                aria-label="height"
              />
            </div>
          </InspectorField>
        </Stack>
      </div>
      <div>
        <div className={styles.sectionTitle}>Properties</div>
        {CustomInspector ? (
          // Canvas-wide widget list is threaded through a context so
          // Inspectors in `@obs/widgets` can read it without importing
          // app-local state (packages can't import from apps).
          <CanvasWidgetsProvider
            widgets={projectWidgets.map((w) => ({ id: w.id, kind: w.kind, name: w.name }))}
          >
            <CustomInspector
              widget={widget}
              update={(patch) => updateProps(widget.id, patch as Record<string, unknown>)}
            />
          </CanvasWidgetsProvider>
        ) : (
          <ZodRenderer
            schema={def.schema as never}
            value={widget.props as Record<string, unknown>}
            onChange={handlePropChange}
            idPrefix={`prop-${widget.id}`}
          />
        )}
      </div>
    </Stack>
  );
}
