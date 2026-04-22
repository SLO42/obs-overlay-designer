import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = (name: string) => resolve(__dirname, "../../packages", name, "src");

const pkgs = ["core", "design-system", "widgets", "effects", "twitch", "donations"] as const;

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
