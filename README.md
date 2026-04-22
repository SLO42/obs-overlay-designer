# obs-overlay-designer

## Repo Layout

This is a pnpm monorepo.

```
apps/
  builder/   # @obs/builder — Vite + React editor SPA (port 5173)
  overlay/   # @obs/overlay — Vite + React runtime loaded by OBS (port 5174)
packages/
  core/           # @obs/core — shared types and primitives
  design-system/  # @obs/design-system — UI tokens and primitives
  widgets/        # @obs/widgets — widget registry and implementations
  twitch/         # @obs/twitch — Twitch integrations
  donations/      # @obs/donations — donation integrations
```

## Dev Commands

Install dependencies once:

```
pnpm install
```

Common scripts at the repo root:

```
pnpm dev:builder     # run the builder app (http://localhost:5173)
pnpm dev:overlay     # run the overlay runtime (http://localhost:5174)
pnpm build           # build every workspace package / app
pnpm build:builder   # build just the builder app
pnpm build:overlay   # build just the overlay app
pnpm typecheck       # run tsc --noEmit across all workspaces
pnpm test            # run vitest
pnpm lint            # prettier --check .
```

Target toolchain: Node 22.12, pnpm 10.33.

## Deployment

The builder SPA deploys to Vercel. The overlay is built first (producing a single inlined
`overlay.html`) and is copied into the builder's dist as `overlay-template.html`, which the
builder's Export flow fetches and injects the project JSON into for the user to download.

- `vercel.json` drives Vercel: root install, ordered `overlay → builder` build, output from
  `apps/builder/dist`. SPA rewrite lets unknown paths fall back to `index.html` while
  `overlay-template.html`, `assets/*`, and favicon routes pass through.
- Production deploys trigger automatically on push to `main` via Vercel's GitHub integration.
  PRs get preview deployments from the same app.
- `.github/workflows/ci.yml` runs typecheck · lint · test · build on every PR and push to
  `main`. The overlay template is uploaded as an artifact on pushes to `main` so you can
  download the authoritative build without re-running it locally.

One-time setup:

1. In the Vercel dashboard, import the GitHub repo `SLO42/obs-overlay-designer`.
2. Leave Framework Preset empty — `vercel.json` overrides everything that matters.
3. Leave Root Directory as the repo root.
4. No environment variables are required for the MVP. Future Twitch integration will add
   `VITE_TWITCH_CLIENT_ID` (Implicit Grant).
