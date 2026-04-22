import { defineConfig } from "vitest/config";

/**
 * Core ships the overlay bus + a React context that consumes it. The
 * context helpers need a DOM to render; the rest (eventBus, ids) don't,
 * but happy-dom is cheap and keeps a single config.
 */
export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
