import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = (name: string) => resolve(__dirname, "../", name, "src");

const pkgs = ["core", "twitch"] as const;

/**
 * The twitch package mixes environments: the auth/popup helpers and the
 * React hook need a DOM (happy-dom), while the state-machine / zod parser
 * tests are fine in node. Running everything in happy-dom is cheapest and
 * keeps this config identical in shape to builder/overlay.
 */
export default defineConfig({
  resolve: {
    alias: [
      ...pkgs.map((name) => ({
        find: new RegExp(`^@obs/${name}/(.+)$`),
        replacement: `${pkg(name)}/$1`,
      })),
      ...pkgs.map((name) => ({
        find: `@obs/${name}`,
        replacement: `${pkg(name)}/index.ts`,
      })),
    ],
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
