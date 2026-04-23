import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = (name: string) => resolve(__dirname, "../../packages", name, "src");

const pkgs = ["core", "design-system", "widgets", "effects", "twitch", "donations", "tts"] as const;

export default defineConfig({
  // Read `.env*` from the monorepo root so VITE_TWITCH_CLIENT_ID is
  // available at build time when the overlay stamps itself with the
  // client id (auto-connect path).
  envDir: resolve(__dirname, "../.."),
  plugins: [
    react(),
    // Task 7: produce a single dist/index.html with JS + CSS inlined. The
    // builder's Export flow fetches this file and injects the project as an
    // <script id="overlay-config"> tag before the user downloads it.
    viteSingleFile({ removeViteModuleLoader: true }),
  ],
  server: {
    port: 5174,
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
    ],
  },
  build: {
    // Force every referenced asset (fonts, images, anything vite would
    // normally emit as a separate file under /assets) to be inlined as a
    // data URI. This is how the local KG Second Chances TTFs end up as
    // base64 in the single HTML file — vite-plugin-singlefile v2.x has no
    // explicit "inline fonts" knob, so we raise the asset inline limit to
    // a value larger than any plausible font file.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    // One chunk only — helps vite-plugin-singlefile inline everything into
    // index.html without orphaned JS/CSS files.
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
