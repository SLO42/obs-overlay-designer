# Builder UI Kit

The main StreamTeam app. A single-screen SPA with:

- **Top toolbar** — logo, project breadcrumb, stage switcher (builder / preview / deploy), connection badge, undo/redo, deploy.
- **Left rail** — widget palette, filterable by signal lane (chat / alerts / emotes / points / events). Drag or double-click to add.
- **Canvas** — 1920×1080 preview stage scaled to fit; placed widgets render mini-previews; selection handles on the active widget. Dotted art-board background. LIVE readout strip top and bottom.
- **Right inspector** — tabs: style, data, triggers, debug. `InspectorField` wrapper (label / control / desc / error) drives every form row.
- **Start scene** — on first app load, a 3D CSS hallway with violet strip-lights; camera walks in, doors open, the builder reveals. Dismissable; `localStorage` remembers you've seen it.

## Files

- `index.html` — composes everything
- `builder.css` — all styles; imports `../../colors_and_type.css`
- `Primitives.jsx` — Icon (inline Lucide paths), Logo, Kbd, Badge, Button, IconButton
- `Toolbar.jsx` — top bar
- `LeftRail.jsx` — widget palette + lane filter
- `Canvas.jsx` — the stage + mini widget previews
- `Inspector.jsx` — right rail + Style/Data/Triggers/Debug tabs + form controls
- `StartScene.jsx` — the 3D CSS-3D entry hallway

## Notes

- This is a **visual recreation** — drag, deploy, and WebSocket flows are stubbed. Good enough for design iteration; not production.
- The 3D start scene is pure CSS (`transform-style: preserve-3d`). No WebGL — renders on any modern browser.
- The canvas zoom is locked at 42% here to fit 1920×1080 in the viewport preview. In the real app it's user-controllable.
