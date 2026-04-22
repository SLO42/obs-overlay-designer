import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { z } from "zod";
import { ZodRenderer } from "../inspector/ZodRenderer";

/**
 * Smoke-tests the zod-to-control mapping. We assert on accessible-name
 * (via InspectorField label) + role where possible so tests stay
 * decoupled from exact DOM class names.
 */
describe("ZodRenderer", () => {
  function renderSchema<Schema extends z.ZodObject<z.ZodRawShape>>(
    schema: Schema,
    value: Record<string, unknown>,
  ) {
    const onChange = vi.fn();
    const utils = render(<ZodRenderer schema={schema} value={value} onChange={onChange} />);
    return { ...utils, onChange };
  }

  it("renders a text Input for a plain z.string()", () => {
    renderSchema(z.object({ title: z.string() }), { title: "hello" });
    const input = screen.getByDisplayValue("hello") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    // Not a color swatch — color fields have role=... we just check it's a textual input.
    expect(input.type).toBe("text");
  });

  it("renders a ColorInput when the regex looks like a hex color", () => {
    renderSchema(z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }), { color: "#ff00aa" });
    // ColorInput renders both a native color input and a text hex input.
    const nativeColor = document.querySelector('input[type="color"]');
    expect(nativeColor).not.toBeNull();
  });

  it("renders a ColorInput when the field name starts with `color`", () => {
    renderSchema(z.object({ colorTint: z.string() }), { colorTint: "#112233" });
    const nativeColor = document.querySelector('input[type="color"]');
    expect(nativeColor).not.toBeNull();
  });

  it("renders a NumberField for z.number() with bounds", () => {
    const { container } = renderSchema(z.object({ fontSize: z.number().int().min(8).max(72) }), {
      fontSize: 14,
    });
    const input = container.querySelector('input[inputmode="decimal"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("14");
  });

  it("renders a Slider for opacity-style 0..1 ranges", () => {
    renderSchema(z.object({ opacity: z.number().min(0).max(1) }), { opacity: 0.5 });
    const slider = screen.getByRole("slider");
    expect(slider).toBeTruthy();
    expect(slider.getAttribute("aria-valuenow")).toBe("0.5");
  });

  it("renders a Switch for z.boolean()", () => {
    renderSchema(z.object({ enabled: z.boolean() }), { enabled: true });
    const sw = screen.getByRole("switch");
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("renders a Select for z.enum()", () => {
    renderSchema(z.object({ align: z.enum(["left", "center", "right"]) }), { align: "left" });
    // Radix Select renders a button as the trigger with combobox role.
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeTruthy();
    // The current value shows up as text.
    expect(trigger.textContent).toContain("Left");
  });

  it("recurses into nested z.object() fields", () => {
    renderSchema(
      z.object({
        background: z.object({
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          paddingX: z.number().int().min(0).max(100),
        }),
      }),
      { background: { color: "#ffffff", paddingX: 10 } },
    );
    // Nested Color input should be present.
    const colorInputs = document.querySelectorAll('input[type="color"]');
    expect(colorInputs.length).toBeGreaterThan(0);
    const numberInput = document.querySelector('input[inputmode="decimal"]') as HTMLInputElement;
    expect(numberInput.value).toBe("10");
  });

  it("falls back to a disabled input for unsupported types", () => {
    renderSchema(z.object({ weird: z.any() }), { weird: "x" });
    // Nothing to match by role; look for the placeholder text.
    const fallback = document.querySelector("input[disabled]") as HTMLInputElement | null;
    expect(fallback).not.toBeNull();
    expect(fallback!.placeholder).toContain("unsupported:");
  });

  it("caps recursion at MAX_DEPTH and renders a disabled input", () => {
    // Inside the cap the deepest object is still recursed; hitting the cap
    // requires an object at depth === MAX_DEPTH. Build a chain of nested
    // objects that bottoms out at a terminal object (depth 4) to force it.
    const schema = z.object({
      a: z.object({
        b: z.object({
          c: z.object({
            d: z.object({
              e: z.object({ x: z.string() }),
            }),
          }),
        }),
      }),
    });
    renderSchema(schema, { a: { b: { c: { d: { e: { x: "x" } } } } } });
    const disabled = document.querySelector("input[disabled]");
    expect(disabled).not.toBeNull();
  });
});
