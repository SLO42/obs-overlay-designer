import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = (name: string) => resolve(__dirname, "../../packages", name, "src");
const overlaySrc = resolve(__dirname, "../overlay/src");
const overlayDistIndex = resolve(__dirname, "../overlay/dist/index.html");

const pkgs = ["core", "design-system", "widgets", "twitch", "donations"] as const;

/**
 * Dev-only middleware that serves `/overlay-template.html` from the sibling
 * overlay app's `dist/index.html`. Task 7's Export flow fetches this URL to
 * stamp the current project into a single-file overlay download.
 *
 * If the overlay hasn't been built yet, we respond with a small placeholder
 * HTML that surfaces the exact command to run — that way the builder's
 * Export dialog can show a clear error instead of a cryptic 404.
 */
function overlayTemplateDevPlugin(): Plugin {
  const URL_PATH = "/overlay-template.html";
  return {
    name: "obs:overlay-template-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(URL_PATH, async (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          next();
          return;
        }
        try {
          const html = await readFile(overlayDistIndex, "utf8");
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.end(html);
        } catch {
          // No overlay build on disk yet. Return a tiny placeholder so the
          // builder's Export flow shows a useful error message.
          const placeholder = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Overlay template missing</title>
  </head>
  <body>
    <!-- overlay-template-missing -->
    <p>The overlay template has not been built yet.</p>
    <p>Run <code>pnpm --filter @obs/overlay build</code> once, then refresh.</p>
  </body>
</html>
`;
          res.statusCode = 503;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("X-Overlay-Template", "missing");
          res.end(placeholder);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), overlayTemplateDevPlugin()],
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
