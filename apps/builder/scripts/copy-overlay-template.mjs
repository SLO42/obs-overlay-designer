#!/usr/bin/env node
// Post-build step for @obs/builder (Task 7).
//
// Copies the overlay app's single-file build output
// (apps/overlay/dist/index.html) into the builder's own dist/ under
// the well-known path dist/overlay-template.html, where the deployed
// builder can fetch it over HTTP at /overlay-template.html.
//
// Fails with a helpful error if the overlay hasn't been built yet —
// the builder's build depends on that artifact existing.

import { readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const builderRoot = resolve(__dirname, "..");
const overlayDistIndex = resolve(builderRoot, "../overlay/dist/index.html");
const builderDistDir = resolve(builderRoot, "dist");
const outPath = resolve(builderDistDir, "overlay-template.html");

async function main() {
  try {
    await stat(overlayDistIndex);
  } catch {
    console.error(
      [
        "[copy-overlay-template] Overlay build artifact not found:",
        `  ${overlayDistIndex}`,
        "",
        "Build the overlay first, then re-run the builder build:",
        "  pnpm --filter @obs/overlay build",
        "  pnpm --filter @obs/builder build",
      ].join("\n"),
    );
    process.exit(1);
  }

  try {
    await mkdir(builderDistDir, { recursive: true });
  } catch (err) {
    console.error(`[copy-overlay-template] Failed to create ${builderDistDir}:`, err);
    process.exit(1);
  }

  const html = await readFile(overlayDistIndex, "utf8");
  await writeFile(outPath, html, "utf8");
  const sizeKb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
  console.log(`[copy-overlay-template] Copied overlay template -> ${outPath} (${sizeKb} kB)`);
}

main().catch((err) => {
  console.error("[copy-overlay-template] Unexpected error:", err);
  process.exit(1);
});
