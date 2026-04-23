import { defineConfig } from "vitest/config";

/**
 * TTS package ships both pure utilities (parser, profile resolver) and a
 * React hook. happy-dom gives us `window` for the hook tests and for the
 * fake `SpeechSynthesis` injections the speak tests do. happy-dom itself
 * does NOT implement `window.speechSynthesis`, so `speak.test.ts` and
 * `useTTS.test.tsx` construct their own fakes and pass them in as deps.
 */
export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
