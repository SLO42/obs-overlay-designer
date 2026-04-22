import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = (name: string) => resolve(__dirname, "../../packages", name, "src");

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@obs/core": pkg("core") + "/index.ts",
      "@obs/design-system": pkg("design-system") + "/index.ts",
      "@obs/widgets": pkg("widgets") + "/index.ts",
      "@obs/twitch": pkg("twitch") + "/index.ts",
      "@obs/donations": pkg("donations") + "/index.ts",
    },
  },
});
