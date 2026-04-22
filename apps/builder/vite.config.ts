import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = (name: string) => resolve(__dirname, "../../packages", name, "src");
const overlaySrc = resolve(__dirname, "../overlay/src");

const pkgs = ["core", "design-system", "widgets", "twitch", "donations"] as const;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
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
      // The overlay app is also consumed by the builder (for makePreviewUrl
      // + HostMessage types). Mirror the subpath + bare patterns used above.
      { find: /^@obs\/overlay\/(.+)$/, replacement: `${overlaySrc}/$1` },
      { find: "@obs/overlay", replacement: `${overlaySrc}/index.ts` },
    ],
  },
});
