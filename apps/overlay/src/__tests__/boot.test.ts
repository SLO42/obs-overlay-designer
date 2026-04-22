import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@obs/core";
import {
  decodeBase64UrlJson,
  encodeBase64UrlJson,
  resolveConfig,
  type OverlayConfig,
} from "../boot";

function makeProject(): Project {
  return {
    meta: {
      id: "p1",
      name: "Test",
      createdAt: 1,
      updatedAt: 2,
      version: 1,
    },
    canvas: { width: 1920, height: 1080 },
    widgets: [],
  };
}

describe("boot/resolveConfig", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Clean any previous script tag from prior test.
    const prior = document.getElementById("overlay-config");
    if (prior) prior.remove();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    const prior = document.getElementById("overlay-config");
    if (prior) prior.remove();
  });

  it("parses config from <script id=overlay-config type=application/json>", () => {
    const project = makeProject();
    const config: OverlayConfig = { project };
    const el = document.createElement("script");
    el.id = "overlay-config";
    el.type = "application/json";
    el.textContent = JSON.stringify(config);
    document.head.appendChild(el);

    const resolved = resolveConfig(document, "");
    expect(resolved).not.toBeNull();
    expect(resolved!.project.meta.id).toBe("p1");
  });

  it("parses config from ?cfg= base64url URL param", () => {
    const project = makeProject();
    const config: OverlayConfig = { project };
    const encoded = encodeBase64UrlJson(config);

    const resolved = resolveConfig(document, `?cfg=${encoded}`);
    expect(resolved).not.toBeNull();
    expect(resolved!.project.canvas.width).toBe(1920);
  });

  it("prefers the embedded <script> tag over ?cfg= when both are present", () => {
    const embedded: OverlayConfig = {
      project: { ...makeProject(), meta: { ...makeProject().meta, id: "embedded" } },
    };
    const el = document.createElement("script");
    el.id = "overlay-config";
    el.type = "application/json";
    el.textContent = JSON.stringify(embedded);
    document.head.appendChild(el);

    const urlConfig: OverlayConfig = {
      project: { ...makeProject(), meta: { ...makeProject().meta, id: "url" } },
    };
    const encoded = encodeBase64UrlJson(urlConfig);

    const resolved = resolveConfig(document, `?cfg=${encoded}`);
    expect(resolved!.project.meta.id).toBe("embedded");
  });

  it("returns null when neither script tag nor ?cfg= param exist", () => {
    expect(resolveConfig(document, "")).toBeNull();
    expect(resolveConfig(document, "?other=value")).toBeNull();
  });

  it("returns null and logs on malformed embedded JSON", () => {
    const el = document.createElement("script");
    el.id = "overlay-config";
    el.type = "application/json";
    el.textContent = "{ not valid json";
    document.head.appendChild(el);

    const resolved = resolveConfig(document, "");
    expect(resolved).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns null and logs on malformed base64url payload", () => {
    // "AAAA" is valid base64 (decodes to three NUL bytes) but the decoded
    // bytes aren't valid JSON, so JSON.parse throws and the catch branch
    // logs + returns null.
    const resolved = resolveConfig(document, "?cfg=AAAA");
    expect(resolved).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns null on invalid base64 length", () => {
    // A single-char payload has length%4 === 1, which the decoder rejects
    // before calling atob. No error log — this is a short-circuit.
    const resolved = resolveConfig(document, "?cfg=x");
    expect(resolved).toBeNull();
  });

  it("base64url encode/decode round-trips unicode", () => {
    const value = { project: makeProject(), note: "hello — — 漢字" };
    const encoded = encodeBase64UrlJson(value);
    // URL-safe: contains no +, /, or =
    expect(encoded).not.toMatch(/[+/=]/);
    const decoded = decodeBase64UrlJson<typeof value>(encoded);
    expect(decoded).toEqual(value);
  });
});
