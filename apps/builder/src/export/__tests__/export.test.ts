import { describe, expect, it } from "vitest";
import type { Project } from "@obs/core";
import { buildOverlayHtml, safeFilename } from "../export";

/**
 * Minimal skeleton template. Mirrors the shape of the real overlay
 * index.html (doctype + head + body with #root) but stays tiny so test
 * failures are readable.
 */
const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Overlay Runtime</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">console.log("overlay runtime");</script>
  </body>
</html>
`;

function makeProject(over: Partial<Project> = {}): Project {
  return {
    meta: {
      id: "proj-1",
      name: "Test Project",
      createdAt: 1,
      updatedAt: 2,
      version: 1,
    },
    canvas: { width: 1920, height: 1080 },
    widgets: [],
    ...over,
  };
}

/**
 * DOMParser is available in the builder's test environment (happy-dom).
 * Parsing the rendered string and asking the browser for the script tag's
 * textContent is the closest we can get to "what actually happens when a
 * user opens the file in a real browser" without spawning one.
 */
function readConfigFromHtml(html: string): unknown {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const el = doc.getElementById("overlay-config");
  if (!el) throw new Error("No #overlay-config in parsed HTML");
  return JSON.parse(el.textContent ?? "");
}

describe("buildOverlayHtml", () => {
  it("injects the overlay-config script just before </head>", () => {
    const project = makeProject();
    const html = buildOverlayHtml({ project, templateHtml: TEMPLATE });

    // The script appears, and it appears before </head>.
    expect(html).toMatch(/<script id="overlay-config" type="application\/json">/);
    expect(html.indexOf('id="overlay-config"')).toBeLessThan(html.indexOf("</head>"));

    // Round-trip: the parsed JSON matches the input project.
    const parsed = readConfigFromHtml(html) as Project;
    expect(parsed.meta.name).toBe("Test Project");
    expect(parsed.canvas).toEqual({ width: 1920, height: 1080 });
  });

  it("replaces (not duplicates) an existing overlay-config script on re-export", () => {
    const first = buildOverlayHtml({
      project: makeProject({ meta: { ...makeProject().meta, name: "First" } }),
      templateHtml: TEMPLATE,
    });
    const second = buildOverlayHtml({
      project: makeProject({ meta: { ...makeProject().meta, name: "Second" } }),
      templateHtml: first,
    });

    // Only one config script total.
    const matches = second.match(/id="overlay-config"/g) ?? [];
    expect(matches).toHaveLength(1);

    // And it reflects the second export, not the first.
    const parsed = readConfigFromHtml(second) as Project;
    expect(parsed.meta.name).toBe("Second");
  });

  it("throws a clear error when the template is missing </head>", () => {
    const broken = "<!doctype html><html><body>oops</body></html>";
    expect(() => buildOverlayHtml({ project: makeProject(), templateHtml: broken })).toThrow(
      /missing a <\/head>/,
    );
  });

  it("neutralizes </script> substrings inside project strings so the browser can't break out", () => {
    const dangerous = 'literal </script> inside "quotes"';
    const project = makeProject({
      meta: { ...makeProject().meta, name: dangerous },
    });
    const html = buildOverlayHtml({ project, templateHtml: TEMPLATE });

    // The raw sequence must not appear inside the <script id="overlay-config">…</script>
    // block. We extract just the script body (lazy match up to the CLOSING
    // overlay-config tag, which is the only </script> our escaping should
    // allow through) and assert no other </script> lurks.
    const body = html.match(
      /<script id="overlay-config" type="application\/json">([\s\S]*?)<\/script>/,
    );
    expect(body).not.toBeNull();
    expect(body![1]).not.toContain("</script>");
    expect(body![1]).not.toContain("</SCRIPT>");

    // DOMParser round-trip restores the exact string.
    const parsed = readConfigFromHtml(html) as Project;
    expect(parsed.meta.name).toBe(dangerous);
  });

  it("survives U+2028 / U+2029 in project strings", () => {
    // "A<LS>B<PS>C" where LS = U+2028, PS = U+2029.
    const tricky = "A B C";
    const project = makeProject({
      meta: { ...makeProject().meta, name: tricky },
    });
    const html = buildOverlayHtml({ project, templateHtml: TEMPLATE });

    // The emitted script body should not contain raw U+2028 or U+2029.
    const body = html.match(
      /<script id="overlay-config" type="application\/json">([\s\S]*?)<\/script>/,
    );
    expect(body).not.toBeNull();
    expect(body![1]).not.toContain(" ");
    expect(body![1]).not.toContain(" ");

    const parsed = readConfigFromHtml(html) as Project;
    expect(parsed.meta.name).toBe(tricky);
  });

  it("preserves accessToken in project.twitch for the exported overlay", () => {
    // Task 10: exported overlay.html carries the token so the Browser
    // Source can auto-connect. Persistence (IndexedDB) still drops it,
    // so the token never leaves the user's device without explicit
    // intent (download + share of the HTML).
    const project = makeProject({
      twitch: {
        clientId: "abc",
        channelLogin: "me",
        accessToken: "STAMPED_INTO_EXPORT",
      },
    });
    const html = buildOverlayHtml({ project, templateHtml: TEMPLATE });

    const parsed = readConfigFromHtml(html) as Project;
    expect(parsed.twitch?.clientId).toBe("abc");
    expect(parsed.twitch?.channelLogin).toBe("me");
    expect(parsed.twitch?.accessToken).toBe("STAMPED_INTO_EXPORT");
  });
});

describe("safeFilename", () => {
  it("keeps safe characters", () => {
    expect(safeFilename("streamteam")).toBe("streamteam");
    expect(safeFilename("my-overlay_1")).toBe("my-overlay_1");
  });

  it("replaces disallowed characters with hyphens and collapses runs", () => {
    expect(safeFilename("My Cool Overlay!!!")).toBe("my-cool-overlay");
    expect(safeFilename("foo / bar / baz")).toBe("foo-bar-baz");
  });

  it("falls back to streamteam for empty or all-bad names", () => {
    expect(safeFilename("")).toBe("streamteam");
    expect(safeFilename("    ")).toBe("streamteam");
    expect(safeFilename("!!!")).toBe("streamteam");
  });

  it("lowercases", () => {
    expect(safeFilename("STREAMTEAM")).toBe("streamteam");
  });
});
