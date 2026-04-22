import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = (name: string) => resolve(__dirname, "../", name, "src");

const pkgs = ["core"] as const;

/**
 * The effects package is pure DOM — every player touches an HTMLElement,
 * so happy-dom is mandatory. We alias `@obs/core` to its source so the
 * workspace `Effect` union resolves without a build step.
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
    include: ["src/**/*.test.ts"],
  },
});
