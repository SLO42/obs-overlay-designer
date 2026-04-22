import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = (name: string) => resolve(__dirname, "../", name, "src");

const pkgs = ["core", "design-system", "twitch"] as const;

/**
 * Widget tests live in two environments:
 *  - zod schema tests are pure data, but
 *  - Runtime component tests need a DOM.
 * happy-dom is cheap enough that we run everything against it; it matches
 * the twitch + builder configs so failures reproduce consistently.
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
    css: {
      modules: {
        classNameStrategy: "non-scoped",
      },
    },
  },
});
