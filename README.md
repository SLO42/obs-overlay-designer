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
