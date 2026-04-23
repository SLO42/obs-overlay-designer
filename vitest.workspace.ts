import { defineWorkspace } from "vitest/config";

/**
 * Workspace config so each app/package can dictate its own test environment.
 * The root vitest.config.ts is still the default for anything not matched
 * below (it runs with `environment: "node"`).
 */
export default defineWorkspace([
  "packages/core",
  "packages/widgets",
  "packages/twitch",
  "packages/effects",
  "packages/tts",
  "apps/builder",
  "apps/overlay",
]);
