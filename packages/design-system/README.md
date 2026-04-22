# StreamTeam Design System

> A production-tool design system for a client-only SPA that assembles and ships OBS browser-source overlays for Twitch streamers.

## Product context

**StreamTeam** is a single-page app where a streamer assembles the "crew" of widgets that run on their live stream — chat feed, emote wall, alert boxes, channel-point triggers, custom keyword effects. The builder renders a live preview of a 1920×1080 overlay; the output is a single HTML file that OBS loads as a Browser Source and that connects directly to Twitch EventSub over WebSocket.

The design system feels like a **production tool**: dark surfaces, dense information, quiet typography, confident accents. Think DAW / video-switcher UI, not consumer SaaS. Tokens are CSS custom properties; components are React + CSS Modules.

A signature characteristic: despite the production-tool density, StreamTeam is also playful — there are **3D scene transitions** (camera turns, hallway flythroughs) at key moments (app start, overlay deploy, tab changes) and a persistent **art-canvas** motif. The streamer is painting a stage, and the tool should feel like that.

## Sources

- **Codebase:** `SLO42/obs-overlay-designer` on GitHub — currently empty (stub README only). Brief is greenfield; no existing components to mirror.
- **Reference inspiration (from the brief):**
  - `https://sabrinasettle.com/` — quiet editorial dark portfolio, loose grids, inline caption layering
  - `https://randofy.vercel.app/` — low-chrome brand, playful typography, loose editorial
  - `https://me.sl0.dev/` — dev-toy aesthetic
- **Brief pillars:** dark surfaces · dense info · quiet type · confident accent · DAW/switcher not SaaS · single violet accent + standard semantic · 4px grid · system sans + mono · 3D scene moments · art-canvas motif.

## Index

Root manifest:

- `README.md` — this file
- `SKILL.md` — Agent Skill entry point (cross-compatible with Claude Code)
- `colors_and_type.css` — all CSS custom-property tokens + semantic type classes
- `fonts/` — (none; using Google Fonts CDN — see CAVEATS)
- `assets/` — logos, icon references, wordmark
- `preview/` — individual cards shown in the Design System tab
- `ui_kits/builder/` — UI kit for the builder app (toolbar + rails + canvas + inspector) and the 3D start-scene
- `ui_kits/overlay/` — UI kit for the rendered overlay primitives (chat, alert, emote wall) as OBS browser-source components

---

## Content fundamentals

**Voice.** Direct, technical, faintly irreverent. The user is a streamer-engineer — they want status, shortcuts, and raw values, not marketing warmth. No exclamation marks in UI copy; one em-dash is fine.

**Person.** Second-person imperative for actions (`Connect Twitch`, `Add widget`, `Deploy overlay`). First-person never. System speaks back in plain present tense: `Connected as @handle`, `Listening for redemptions`, `3 widgets on canvas`.

**Casing.** `Sentence case` for buttons, menus, and headings. `Tracked-out UPPERCASE` only for micro-labels in the inspector and status strip (`INPUT`, `CANVAS`, `LIVE`). Never SCREAMING CASE in body copy.

**Numbers.** Always tabular-nums in readouts. Prefer real values over fuzzy descriptors: `1920 × 1080`, `+12 dB`, `240 ms`, `#8B5CF6`. Units stay attached (`240ms`, `1.5x`), no space.

**Emoji.** Not used in system UI. Emoji appear only as stream content (chat messages, emote wall) — they are user data, not brand voice. One exception: the accent-colored paint-drip glyph (`◣`-ish monogram) that functions as the logo.

**Tone examples.**

| ❌ Don't say | ✅ Say |
|---|---|
| "Awesome! Your overlay is live 🎉" | "Overlay live · port 4567 · OBS can fetch now" |
| "Oops, something went wrong!" | "EventSub dropped. Reconnecting in 3s." |
| "Welcome back, streamer!" | "Welcome back. Last session: 2h 14m ago." |
| "Customize your widgets here" | "Widgets — drag onto canvas · double-click to configure" |

**Copy in error/empty states.** Concrete cause, next action, keyboard shortcut if relevant. Example: `Canvas is empty. Drag a widget from the left rail, or press ⌘K → "Add Chat".`

---

## Visual foundations

### Palette

- **Chrome:** dark cool-neutral, hue ~230. Page `#0b0d12`, panels `#11141b`, cards `#1a1e27`. The OBS preview stage uses a deeper `#07080b` for contrast with the chrome.
- **Accent:** **violet `#8b5cf6`** (single primary). Used sparingly — active tool, focus ring, primary CTA, and selection highlight. Never on large surfaces.
- **Semantic:** green `#2fb37a` (success/connected), amber `#e6a23c` (warning/drift), pink-red `#ef4b6b` (danger/error), blue `#4da3ff` (info/live).
- **Signal lanes:** each widget category gets a channel color (chat=green, alerts=pink, emotes=amber, points=violet, events=blue). Used on inspector tabs, waveforms, and the canvas layer rail — NOT on the widget output itself.
- All color values live in `colors_and_type.css` as custom properties.

### Typography

Three families, each with a distinct job:

- **`Inter`** — UI workhorse. Used for 95% of text. Sizes 11–16 for the tool, 20–28 for section headers in marketing/empty states. Weights 400/500/600/700.
- **`Bricolage Grotesque`** — brand display. Used only for the wordmark, empty-state hero copy, and the 3D-scene entry titles. Geometric grotesk with tight tracking at large sizes.
- **`JetBrains Mono`** — readouts, code, tokens, keyboard shortcuts, numeric fields. Tabular numerals on by default.

### Spacing & sizing

- **4px grid** strictly: 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96.
- **Rows are dense:** default input/button height 30px, compact 26px, comfortable 36px. Icon buttons square at the row height. Row padding is 8/12, never 16.
- **Panels** have 12px interior padding; nested lists use 8.
- **Gutters** between major regions are 1px (the dividing border), not gaps. This is a DAW, not a Figma file.

### Radii

- `sm: 3px` (inputs, chips, tags)
- `md: 6px` (buttons, cards)
- `lg: 10px` (panels, dialogs)
- `full: 999px` (avatars, pills, the paint-blob logo)
- Extra-large `16px` reserved for the 3D scene panels and marketing surfaces.

### Shadows & elevation

Layered, violet-tinted, never puffy.

- **`sm`** — hairline + 2px drop. Sits inputs on surface.
- **`md`** — menus, poppers, tooltips.
- **`lg`** — modals, dialogs, fullscreen overlays.
- **`glow`** — 1px violet ring + 24px soft-bloom. Applied on focus and the live-deploy pulse.
- **`inset`** — 1px top-highlight + 1px inset-border. Default on cards and panels to give them a subtle bezel.

### Borders

- **Subtle `#20242e`** — dividers inside panels.
- **Default `#333845`** — input borders, panel edges.
- **Strong `#4a5162`** — when a row is focused but not selected.
- **Accent violet** — active/selected state, focus ring, primary button border on hover.

### Focus ring

`2px inner canvas-color gap + 2px violet ring` — double-stroke so it survives against any surface (light input, dark panel, or violet button). Danger variant swaps in `#ef4b6b`.

### Backgrounds & textures

- **No gradients** in the tool UI. Flat surfaces only.
- **Dotted art-board grid** (`.ds-canvas-bg`) applied ONLY to the preview stage in the canvas and the 3D scene backdrops. 16px grid, dots at 4% white. This is THE motif.
- **Hairline rectilinear grid** (`.ds-grid-bg`, 8px) used behind empty-state inspector panels and inside the "align to grid" overlay.
- **Scanline texture** in the 3D scene only (CRT-ish feel during transitions), never in the tool chrome.
- **Marketing/empty-state hero** may use a single violet radial glow behind the wordmark. Never in the tool.

### Animation

The brief asks for 3D moments. The system has **two motion registers**:

1. **Tool motion — quiet.** 120ms `ease-out` on hovers, 200ms on state changes. No bouncing. Opacity and 1–2px translate only. Menus fade-in without scaling.
2. **Scene motion — cinematic.** 900ms `cubic-bezier(0.16, 1, 0.3, 1)` for the signature 3D transitions:
   - **App start:** camera pans through a violet-lit hallway, doors open onto the builder.
   - **Overlay deploy:** the canvas flips in Z and settles as an OBS browser source.
   - **Tab/scene change:** camera pivots 90° around the central stage (rare — reserved for 3–5 routes).
3. **Never:** bounces, spring overshoots on the tool UI, skeleton shimmer loops, parallax scroll.

### Hover & press states

- **Hover:** background steps `+1 surface` (surface-2 → surface-3 → hover `#242934`). Buttons: border brightens to strong; fill stays. No scale, no shadow change.
- **Press / active:** background steps `+2` and adds a 1px top inset shadow so the element "pushes in."
- **Disabled:** opacity 0.5 + `cursor: not-allowed`, no color change on surfaces.
- **Selected (persistent):** 1px violet left-border + violet-200 fill background. Used on canvas layer rail and inspector tabs.

### Transparency & blur

- **Blur** is reserved for the 3D scene (backdrop-filter on the passing-through-hallway labels) and for the "right rail is in a drawer" mobile state.
- **Tool surfaces are opaque** — blur hurts scrubbing performance on live preview.
- Poppers (menu, tooltip) use solid surface-3 with `shadow-md`, no backdrop blur.

### Imagery & iconography vibe

- **Color vibe:** cool, slightly desaturated. Violet carries all warmth.
- **No photography** in the tool. Stream previews show whatever the user's camera/capture is — that's their content, we don't style it.
- **Empty states** may include a single oversized line illustration (stroke only, current color, 1.5px stroke) — drawn as SVG.
- **Icons:** Lucide (see ICONOGRAPHY below). Consistent 1.5px stroke. No filled icons in the tool.

### Cards

Flat `bg-surface-3` · `radius-md` · 1px `border-subtle` · `shadow-inset` bezel. On hover, the border steps up to `border-default`. Cards are NEVER elevated with a drop shadow in the tool — elevation is reserved for modals.

### Layout rules

- **Fixed chrome:** toolbar (44px), left rail (56px icon rail + 240px when expanded), right inspector rail (320px). All fixed; the canvas absorbs the remaining space and scrolls internally.
- **The stage aspect is always 16:9.** The canvas viewport letterboxes the 1920×1080 preview.
- **One scrollbar rule:** only the inspector, the layer list, and internal stage scroll. The page itself never scrolls.
- **Keyboard-first:** every button has a tooltip with its shortcut. `⌘K` opens the command menu.

---

## Iconography

**System:** [Lucide](https://lucide.dev) (24px stroke-1.5). Used as inline SVG or via `lucide-react`. Consistent geometric sans-serif icon family that matches our Inter + mono pairing.

**Why Lucide:** open-source, wide coverage (~1,400 icons), clean 24px grid, tunable stroke — fits the quiet DAW vibe without looking like Material or SF Symbols (too OS-branded).

**Rules.**

- **Always 1.5px stroke.** The Lucide default is 2; override via `stroke-width="1.5"`. This is non-negotiable across the system.
- **Color** inherits `currentColor`. Muted icons use `--fg-secondary`; active state swaps to `--accent` or the relevant signal-lane color.
- **Sizes:** 14, 16, 18, 20 (default), 24. Never 12 or below — unreadable in a dense UI.
- **No filled icons in the tool.** Filled is reserved for the logo and for the "live" indicator dot, which is a filled circle.
- **No emoji in system UI** — ever. Emoji appear only as user-generated stream content (chat, emote wall).
- **No unicode glyphs as icons.** Keyboard shortcuts DO use `⌘ ⌥ ⇧ ⏎ ⌫` etc. in the monospace `.ds-kbd` style — that's typographic, not iconographic.
- **Flag when substituting.** If Lucide doesn't have a streaming-specific icon (Twitch logo, emote, bit), we use the official brand SVG from the respective brand assets page.

**Logo.** A custom wordmark + paint-blob mark. See `assets/logo.svg` and `assets/wordmark.svg`. The mark is an offset-stacked paint blob that echoes the art-canvas motif.

---

## CAVEATS & NEXT STEPS

**What's incomplete / needs your input:**

1. **Brand display family.** You uploaded `KG Second Chances` (Solid + Sketch) which is now wired as `--font-display` and `--font-display-sketch`. It's a hand-drawn marker face — I've used it for the wordmark, the 3D-scene entry title, and empty-state hero copy. If you wanted it in more places (every heading, inspector labels) say the word and I'll rewire. Inter + JetBrains Mono still CDN-load from Google Fonts; flag if you want them self-hosted.
2. **The linked repo was empty** — there are no existing components, screens, or tokens to mirror. Everything here is derived from the brief text + the three reference sites. If you have Figma files, a prior prototype, or a style deck hidden somewhere, point me at it and I'll re-ground the palette and density.
3. **The 3D moments are built with CSS `transform-style: preserve-3d`** (plus one `html-in-canvas` poly for the hallway labels). `<pretext>` / true html-in-canvas (Chrome's experimental rendering) is referenced in the start-scene as a progressive enhancement — it will work in canary-flag builds and degrade to the CSS-3D version elsewhere. If you want me to lean harder into one or the other, tell me.
4. **No overlay-primitives UI kit yet** — the brief listed only the builder app. I flagged this as a likely follow-up since StreamTeam's output is HTML overlays and we'll want kit-level definitions of `<Alert>`, `<ChatFeed>`, `<EmoteWall>` etc. Say the word and I'll add `ui_kits/overlay/`.

**Open taste calls I made for you:**

- Cool-leaning neutrals (hue 230) over warm or true-gray.
- Bricolage Grotesque as the display font (geometric grotesk with character — closest to option 4 in the taste form).
- Linear-density row heights (30px default).
- Lucide for iconography.

Push back on any of these and I'll re-tune.
