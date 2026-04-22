import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  allWidgets,
  createWidget,
  getWidget,
  registerWidget,
  type WidgetDefinition,
} from "../index";

/**
 * Importing `../index` above runs the side-effect registrations for text
 * and image, so the registry already contains both by the time these tests
 * run. That's intentional: we want to verify the registered state the
 * rest of the app will see.
 */

describe("widget registry", () => {
  it("returns the text definition from getWidget('text')", () => {
    const def = getWidget("text");
    expect(def).toBeDefined();
    expect(def!.kind).toBe("text");
    expect(def!.label).toBe("Text");
    expect(def!.Runtime).toBeTypeOf("function");
  });

  it("returns the image definition from getWidget('image')", () => {
    const def = getWidget("image");
    expect(def).toBeDefined();
    expect(def!.kind).toBe("image");
    expect(def!.Runtime).toBeTypeOf("function");
  });

  it("lists text, image, and chat-feed in allWidgets()", () => {
    const kinds = allWidgets().map((w) => w.kind);
    expect(kinds).toContain("text");
    expect(kinds).toContain("image");
    expect(kinds).toContain("chat-feed");
  });

  it("throws when a duplicate kind is registered", () => {
    const dupe: WidgetDefinition = {
      kind: "text", // already registered
      label: "Dup",
      description: "dup",
      icon: "Type",
      schema: z.object({}) as z.ZodType<Record<string, unknown>>,
      defaults: () => ({}),
      Runtime: () => null,
      eventsConsumed: [],
    };
    expect(() => registerWidget(dupe)).toThrow(/already registered/);
  });

  it("createWidget('text') returns a Widget with fresh 21-char id and default transform", () => {
    const w = createWidget("text");
    expect(w.kind).toBe("text");
    expect(w.id).toHaveLength(21);
    expect(w.transform.w).toBe(480);
    expect(w.transform.h).toBe(120);
    expect(w.transform.rotation).toBe(0);
    expect(w.transform.zIndex).toBe(0);
    expect(w.transform.anchor).toEqual({ x: 0.5, y: 0.5 });
    expect(w.triggers).toEqual([]);
    expect(w.effects).toEqual([]);
    // Defaults from schema landed in props.
    expect(w.props.content).toBe("Text");
    expect(w.props.fontSize).toBe(48);
  });

  it("createWidget('image') applies the image default transform (480x320)", () => {
    const w = createWidget("image");
    expect(w.transform.w).toBe(480);
    expect(w.transform.h).toBe(320);
  });

  it("createWidget merges preset props + transform without mutating defaults", () => {
    const w = createWidget("text", {
      props: { content: "hi" },
      transform: { x: 100, y: 200 },
    });
    expect(w.props.content).toBe("hi");
    // other defaults preserved
    expect(w.props.fontSize).toBe(48);
    expect(w.transform.x).toBe(100);
    expect(w.transform.y).toBe(200);
    // rest of transform from defaults
    expect(w.transform.w).toBe(480);
    expect(w.transform.h).toBe(120);

    // A second call should not be influenced by the first (fresh defaults).
    const w2 = createWidget("text");
    expect(w2.props.content).toBe("Text");
    expect(w2.transform.x).toBe(0);
  });

  it("createWidget honours a preset `name` over the default label", () => {
    const w = createWidget("text", { name: "Title bar" });
    expect(w.name).toBe("Title bar");
    const defaulted = createWidget("text");
    expect(defaulted.name).toBe("Text"); // falls back to `label`
  });

  it("createWidget produces unique ids per call", () => {
    const a = createWidget("text");
    const b = createWidget("text");
    expect(a.id).not.toBe(b.id);
  });

  it("throws when creating an unregistered kind", () => {
    // chat-feed is registered now — pick an unused kind from WidgetKind to
    // exercise the error path.
    expect(() => createWidget("emote-wall" as never)).toThrow(/not registered/);
    expect(() => createWidget("unknown" as never)).toThrow(/not registered/);
  });
});
