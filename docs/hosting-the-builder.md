# Hosting the StreamTeam builder as a Module Federation remote

The builder app (`apps/builder`) exposes a federation remote alongside its
standalone SPA. A parent ("host") application can mount the whole editor
without iframing it, share React, and drive the store from outside.

This doc is the checklist for wiring that up later, once the host stack is
picked.

---

## Remote contract

| Field              | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Remote name        | `streamteam_builder`                                                  |
| Remote entry URL   | `<deploy-origin>/assets/remoteEntry.js`                               |
| Exposed `./Editor` | `<Editor />` — the full 3-pane editor UI                              |
| Exposed `./store`  | Zustand store barrel (`useEditorStore`, actions, persistence helpers) |
| Shared singletons  | `react ^18.3`, `react-dom ^18.3`                                      |
| Runtime target     | `esnext` (top-level await)                                            |

Production remote URL after Vercel is connected:

```
https://<your-vercel-project>.vercel.app/assets/remoteEntry.js
```

Local dev: run the builder with `pnpm --filter @obs/builder dev` and the
remote is served from `http://localhost:5173/assets/remoteEntry.js`.

---

## Host recipes

### 1. Vite + React host (simplest)

```bash
pnpm add -D @originjs/vite-plugin-federation
```

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "host",
      remotes: {
        streamteam_builder: `${process.env.VITE_STREAMTEAM_REMOTE}/assets/remoteEntry.js`,
      },
      shared: {
        react: { singleton: true, requiredVersion: "^18.3" },
        "react-dom": { singleton: true, requiredVersion: "^18.3" },
      },
    }),
  ],
  build: { target: "esnext" },
});
```

`.env`:

```
VITE_STREAMTEAM_REMOTE=https://streamteam.vercel.app
```

Consume:

```tsx
import { Suspense, lazy } from "react";

const Editor = lazy(() => import("streamteam_builder/Editor"));

export function StreamTeamEmbed() {
  return (
    <Suspense fallback={<p>Loading editor…</p>}>
      <Editor />
    </Suspense>
  );
}
```

Drive the store from the host:

```tsx
import { useEffect } from "react";
import type { useEditorStore as UseEditorStore } from "streamteam_builder/store";

async function loadStore(): Promise<typeof UseEditorStore> {
  const mod = await import("streamteam_builder/store");
  return mod.useEditorStore;
}

export function useSharedStore() {
  useEffect(() => {
    loadStore().then((useEditorStore) => {
      // Example: subscribe to selection changes in the host UI
      const unsub = useEditorStore.subscribe(
        (state) => state.selection,
        (sel) => {
          console.log("selection changed:", sel);
        },
      );
      return unsub;
    });
  }, []);
}
```

### 2. Next.js host (App Router)

Next uses webpack under the hood, so you want `NextFederationPlugin` from
`@module-federation/nextjs-mf`:

```bash
pnpm add @module-federation/nextjs-mf
```

`next.config.mjs`:

```js
import NextFederationPlugin from "@module-federation/nextjs-mf";

export default {
  webpack(config, { isServer }) {
    config.plugins.push(
      new NextFederationPlugin({
        name: "host",
        remotes: {
          streamteam_builder: `streamteam_builder@${process.env.NEXT_PUBLIC_STREAMTEAM_REMOTE}/assets/remoteEntry.js`,
        },
        shared: {
          react: { singleton: true, requiredVersion: "^18.3" },
          "react-dom": { singleton: true, requiredVersion: "^18.3" },
        },
        extraOptions: { exposePages: false },
      }),
    );
    return config;
  },
};
```

Import in a client component only (the builder uses browser-only APIs like
IndexedDB and `window`):

```tsx
"use client";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("streamteam_builder/Editor"), { ssr: false });

export default function Page() {
  return <Editor />;
}
```

**Gotcha:** Next 15 ships webpack 5.98 / Turbopack. Check
`@module-federation/nextjs-mf`'s compat matrix before upgrading Next major
versions — MF interop is brittle across webpack majors.

### 3. Plain Webpack 5 host

```ts
// webpack.config.js
const { ModuleFederationPlugin } = require("webpack").container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: "host",
      remotes: {
        streamteam_builder:
          "streamteam_builder@" + process.env.STREAMTEAM_REMOTE + "/assets/remoteEntry.js",
      },
      shared: {
        react: { singleton: true, requiredVersion: "^18.3" },
        "react-dom": { singleton: true, requiredVersion: "^18.3" },
      },
    }),
  ],
};
```

Same consume pattern as the Vite recipe.

---

## TypeScript types

The remote is resolved at runtime, so TS can't see it by default. Declare
the modules in the host's `src/types/streamteam.d.ts`:

```ts
declare module "streamteam_builder/Editor" {
  import type { ComponentType } from "react";
  const Editor: ComponentType;
  export default Editor;
  export { Editor };
}

declare module "streamteam_builder/store" {
  export * from "../../../obs-overlay-designer/apps/builder/src/store";
}
```

The second declaration only works if the host can see the builder's source
on disk (monorepo or git submodule). If the host is in a separate repo,
either:

- Publish a lightweight `@streamteam/types` package from this repo that
  re-exports the store types, **or**
- Hand-write the store interface in the declaration and keep it in sync by
  eye.

A scripted approach: run `tsc --declaration --emitDeclarationOnly
--outDir ../types-dist` from `apps/builder` and publish the resulting
`.d.ts` files as a types package.

---

## Styling, fonts, and the canvas motif

The builder ships **all of its CSS inline with the exposed modules** —
importing `streamteam_builder/Editor` injects:

- `colors_and_type.css` (tokens, semantic type classes, `@font-face` for
  KG Second Chances, Google Fonts `@import` for Inter and JetBrains Mono)
- Primitive CSS Modules
- Editor CSS Modules (toolbar, rails, canvas, inspector)

Implications for the host:

- **Font URLs** — KG Second Chances TTFs are served from the remote's
  origin (`<remote>/assets/KGSecondChancesSolid-*.ttf`). Make sure the
  remote deployment has permissive CORS for fonts (Vercel does by default).
  If you proxy the remote, preserve the `Access-Control-Allow-Origin: *`
  header on `*.ttf` responses.
- **Google Fonts** — the `@import` pulls Inter + JetBrains Mono from
  `fonts.googleapis.com`. If the host environment blocks that, pre-embed
  the same families in the host's own CSS and they'll dedupe.
- **CSS scoping** — the DS and editor styles are CSS Modules (hashed
  class names) so they won't collide with the host. Global tokens on
  `:root` in `colors_and_type.css` will override any `:root` vars of the
  same name in the host. If the host uses a violet accent already, expect
  to namespace your own accent variables.

---

## Portals, modals, tooltips

The builder uses Radix primitives for Dialog/Menu/Tooltip. Radix portals
attach to `document.body` by default. Inside a federated remote, that
still means "the host's document.body." Concretely:

- **Tooltips in the editor will float above host chrome.** That's usually
  what you want, but it bypasses any host-level z-index stacking context.
  If your host has a navbar at `z-index: 9999`, set
  `--z-tooltip: 10100` on the Editor's container to keep tooltips above
  it.
- **Dialogs trap focus in the remote's React tree.** Host keyboard
  shortcuts (Ctrl+K palette, etc.) won't fire while a builder Dialog is
  open — that's the correct accessibility behavior.
- **Backdrop filters** — none in the editor chrome; safe to embed inside
  a host that uses `backdrop-filter: blur` on its own overlays.

---

## Persistence scope

The builder stores projects in **IndexedDB on the host's origin**. If the
host is at `host.example.com` and the remote is served from
`streamteam.vercel.app`, projects save under `host.example.com`'s IDB
(not the remote's). That's the expected behavior since the code runs in
the host's page context.

Implications:

- Users with one builder deployment mounted into multiple hosts each see
  separate project lists.
- Clearing the host's site data wipes all projects.
- If you want cross-host sync, wrap `saveProject` / `loadProject` with a
  host-side service (e.g. Supabase, Firebase) — those helpers are
  exposed from `streamteam_builder/store` for exactly this reason.

---

## Twitch env var

The builder reads `VITE_TWITCH_CLIENT_ID` at **its own build time** (it's
a Vite `import.meta.env` var). The host does **not** need to forward this
variable — it's baked into the remote bundle at
`pnpm --filter @obs/builder build` time.

If the host needs to use a different Client ID per deployment, either:

- Rebuild and redeploy the remote per environment, or
- Refactor the builder's Twitch auth to accept the Client ID via a prop on
  `<Editor clientId={…} />` (a Phase-2 change).

The env value lives in `.env` / `.env.production` of `apps/builder` and
in the Vercel project's Environment Variables UI. It never ends up in
the host's bundle.

---

## Overlay export from the host

`streamteam_builder/Editor`'s Export dialog fetches
`/overlay-template.html` from the **current page's origin**. When mounted
in a host, that means the host must serve a copy of
`overlay-template.html` at its own origin — otherwise Export fails with a 404.

Options:

1. **Proxy** — host proxies `/overlay-template.html` to the remote:

   ```
   /overlay-template.html  →  https://streamteam.vercel.app/overlay-template.html
   ```

   Cleanest. All platforms support this; for Vercel hosts it's a
   `rewrites` entry in `vercel.json`.

2. **Re-serve** — copy the file into the host's static output at build
   time. Fragile; host has to redeploy when the overlay changes.

3. **Refactor** (Phase-2) — expose `buildOverlayHtml` + `fetchTemplate`
   via `streamteam_builder/export` and let the host pass in its own
   template URL.

Track as a follow-up if you hit it.

---

## Version pinning

Because React is a singleton, host and remote must agree on the React
major/minor. Current remote: `react@^18.3`. When we upgrade to React 19:

1. Bump `apps/builder/package.json` deps.
2. Bump the `requiredVersion` in the `shared:` block of
   `apps/builder/vite.config.ts`.
3. Bump the same in every host.
4. Deploy remote first, host second, or you get a dev-build runtime warning.

---

## Local dev with both host and remote running

```
# terminal 1 — remote
cd obs-overlay-designer
pnpm --filter @obs/overlay build           # one-time, for the Export flow
pnpm --filter @obs/builder dev             # serves remoteEntry.js at :5173

# terminal 2 — host
cd your-host-app
VITE_STREAMTEAM_REMOTE=http://localhost:5173 pnpm dev
```

The remote's dev server ships the federation plugin output live, so HMR
works end-to-end for changes in `apps/builder/src/editor/*`.

---

## Known limitations

- **Widget registry is global state.** The registry uses a module-scoped
  Map populated on import of `@obs/widgets/*`. If the host happens to
  bundle its own `@obs/widgets` (pre-published npm package someday), you
  get duplicate registrations → thrown errors. Avoid by only consuming
  the widget surface through the remote.
- **idb-keyval** uses a single, shared store name. Two federated
  deployments on the same host origin would collide. Namespace project
  keys if this ever matters.
- **Vite + webpack MF interop** is solid for production builds but
  occasionally flaky in webpack dev servers. If HMR breaks on the host,
  hard-reload; the production build is unaffected.
