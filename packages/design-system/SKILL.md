---
name: streamteam-design
description: Use this skill to generate well-branded interfaces and assets for StreamTeam, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation

- **Tokens:** `colors_and_type.css` — CSS custom properties for all color / type / spacing / radii / shadows / motion. Always import this first.
- **Fonts:** `fonts/KGSecondChancesSolid.ttf` + `fonts/KGSecondChancesSketch.ttf` (brand display). Inter + JetBrains Mono load from Google Fonts inside the token file.
- **Logo + mark:** `assets/logo.svg`, `assets/wordmark.svg`.
- **Preview cards:** `preview/` — one-off HTML per token family or component. Use as snippet sources.
- **Builder UI kit:** `ui_kits/builder/` — Toolbar, LeftRail, Canvas, Inspector, StartScene (3D hallway intro). React + CSS.
- **Icons:** inline Lucide SVGs with 1.5px stroke — see `preview/icons.html` and `ui_kits/builder/Primitives.jsx`.

## Vibe in one line

Dark DAW-dense production tool, single violet accent, canvas-motif dotted stage, playful 3D scene moments. Never consumer SaaS, never emoji in chrome, never bouncy animation in the tool (reserved for scene transitions only).
