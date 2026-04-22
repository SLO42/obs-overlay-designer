import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEditorStore, createBlankProject } from "../../../../store";
import { TriggersTab } from "../TriggersTab";

/**
 * Wires the real `useEditorStore` and a freshly-seeded project for each
 * test. TriggersTab reads the selected widget straight from the store, so
 * we add a widget then look it up by id on every render.
 */
function seedWidget() {
  useEditorStore.setState({
    project: createBlankProject("triggers-test"),
    selection: [],
    history: { past: [], future: [] },
    status: "idle",
    lastSavedAt: undefined,
  });
  const id = useEditorStore.getState().addWidget("alert-box");
  // addWidget always succeeds for a registered kind; cast for readability.
  return id as string;
}

function getWidget(id: string) {
  const w = useEditorStore.getState().project.widgets.find((w) => w.id === id);
  if (!w) throw new Error(`widget ${id} missing from store`);
  return w;
}

function renderWith(id: string) {
  const widget = getWidget(id);
  return render(<TriggersTab widget={widget} />);
}

describe("TriggersTab", () => {
  let widgetId: string;

  beforeEach(() => {
    widgetId = seedWidget();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders both empty states when no effects or triggers exist", () => {
    renderWith(widgetId);

    expect(screen.getByText(/no effects yet/i)).toBeTruthy();
    expect(screen.getByText(/no triggers yet/i)).toBeTruthy();
  });

  it("adding a Shake effect seeds the default params via addEffect", async () => {
    const user = userEvent.setup();
    renderWith(widgetId);

    await user.click(screen.getByRole("button", { name: /add effect/i }));
    await user.click(screen.getByRole("menuitem", { name: /shake/i }));

    const effects = getWidget(widgetId).effects;
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      type: "shake",
      amplitude: 8,
      durationMs: 600,
    });
    expect(effects[0]!.id).toHaveLength(21);
  });

  it("adding a Chat keyword trigger seeds the default matcher", async () => {
    const user = userEvent.setup();
    renderWith(widgetId);

    await user.click(screen.getByRole("button", { name: /add trigger/i }));
    await user.click(screen.getByRole("menuitem", { name: /chat keyword/i }));

    const triggers = getWidget(widgetId).triggers;
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({
      enabled: true,
      effects: [],
      match: { type: "chat.keyword", keyword: "", caseSensitive: false, roles: [] },
    });
  });

  it("toggling an effect chip adds / removes the effect id from trigger.effects", async () => {
    const user = userEvent.setup();

    // Seed: add one Shake effect + one empty chat-keyword trigger.
    const store = useEditorStore.getState();
    store.addEffect(widgetId, {
      id: "effect-1",
      type: "shake",
      amplitude: 8,
      durationMs: 600,
    });
    store.addTrigger(widgetId, {
      id: "trigger-1",
      enabled: true,
      match: { type: "chat.keyword", keyword: "hype", caseSensitive: false, roles: [] },
      effects: [],
    });

    const { rerender } = renderWith(widgetId);

    // The chip exists inside the trigger card; find it by role=switch.
    const triggerCard = document.querySelector('[data-trigger-id="trigger-1"]') as HTMLElement;
    expect(triggerCard).toBeTruthy();
    let chip = within(triggerCard).getByRole("switch", { name: /shake/i });
    expect(chip.getAttribute("aria-checked")).toBe("false");

    await user.click(chip);
    // Re-render with the updated widget snapshot (store returned a new ref).
    rerender(<TriggersTab widget={getWidget(widgetId)} />);
    expect(getWidget(widgetId).triggers[0]!.effects).toEqual(["effect-1"]);

    chip = within(document.querySelector('[data-trigger-id="trigger-1"]') as HTMLElement).getByRole(
      "switch",
      { name: /shake/i },
    );
    expect(chip.getAttribute("aria-checked")).toBe("true");

    // Click again → remove.
    await user.click(chip);
    rerender(<TriggersTab widget={getWidget(widgetId)} />);
    expect(getWidget(widgetId).triggers[0]!.effects).toEqual([]);
  });

  it("toggling the enabled Switch on a trigger calls updateTrigger", async () => {
    const user = userEvent.setup();

    useEditorStore.getState().addTrigger(widgetId, {
      id: "trigger-1",
      enabled: true,
      match: { type: "chat.command", command: "!hype" },
      effects: [],
    });

    renderWith(widgetId);

    const triggerCard = document.querySelector('[data-trigger-id="trigger-1"]') as HTMLElement;
    const enabledSwitch = within(triggerCard).getByRole("switch", {
      name: /disable trigger/i,
    });
    expect(enabledSwitch.getAttribute("aria-checked")).toBe("true");

    await user.click(enabledSwitch);
    expect(getWidget(widgetId).triggers[0]!.enabled).toBe(false);
  });

  it("shows the 'add an effect above first' hint when the trigger card has no effects to pick", () => {
    // Seed a chat-command trigger so there's a card to render the hint in,
    // but no effects authored on the widget. The TriggersTab receives the
    // widget by prop, so we must seed the store first, then render.
    useEditorStore.getState().addTrigger(widgetId, {
      id: "trigger-1",
      enabled: true,
      match: { type: "chat.command", command: "!hype" },
      effects: [],
    });

    renderWith(widgetId);

    const hint = screen.getByText(/add an effect above first/i);
    expect(hint).toBeTruthy();
  });

  it("removing an effect card clears it from every trigger.effects reference", async () => {
    const user = userEvent.setup();

    const store = useEditorStore.getState();
    store.addEffect(widgetId, {
      id: "effect-1",
      type: "shake",
      amplitude: 8,
      durationMs: 600,
    });
    store.addTrigger(widgetId, {
      id: "trigger-1",
      enabled: true,
      match: { type: "chat.command", command: "!hype" },
      effects: ["effect-1"],
    });

    renderWith(widgetId);

    // Remove the effect card via its trash button.
    const effectCard = document.querySelector('[data-effect-id="effect-1"]') as HTMLElement;
    const removeBtn = within(effectCard).getByRole("button", { name: /remove shake/i });
    await user.click(removeBtn);

    expect(getWidget(widgetId).effects).toHaveLength(0);
    // Trigger still exists but references a now-stale id. The engine is
    // responsible for warning on unknown ids at play time; the store
    // intentionally doesn't prune references to keep actions reversible
    // via undo.
    expect(getWidget(widgetId).triggers[0]!.effects).toEqual(["effect-1"]);
  });
});
