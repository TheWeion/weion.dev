# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal portfolio site (weion.dev) for Terry Fallows. Single-page app with a WebGL-driven "HUD / operator console" aesthetic. Vite + React 19 + TypeScript + React Three Fiber, styled with Tailwind v4, deployed on Netlify. Node 20 (see `.nvmrc`).

## Commands

```bash
npm run dev          # Vite dev server on :5173 (host: true — accessible on LAN)
npm run build        # tsc -b (project references) + vite build -> dist/
npm run preview      # Serve the built dist/ locally
npm run typecheck    # tsc -b --noEmit (no bundle)
npm run lint         # biome lint
npm run format       # biome format --write
npm run format:check # biome format (no writes)
npm run check        # biome check (lint + format + import sort)
npm run check:fix    # biome check --write (the daily driver)
npm run wakatime     # regenerate src/data/wakatime.generated.ts on demand
```

There is no test suite. `npm run build` deliberately runs TypeScript as a project-reference build (`tsc -b`) before Vite, so a type error fails the Netlify build even though Vite itself would transpile through SWC.

`predev` and `prebuild` invoke `scripts/fetch-wakatime.mjs` so the generated telemetry file is always present before tsc/Vite read it.

## Architecture

### Rendering layers (see `src/App.tsx`)

The page is a stack of fixed/absolute layers, not a normal document flow. Z-indices are intentional and form the layer ordering:

| z-index   | Layer                                                                      |
| --------- | -------------------------------------------------------------------------- |
| `z-0`     | `HudScene` (R3F `<Canvas>`) — `Lights`, `HoloOrb`, `AmbientDust`, `GridFloor`, plus a `CameraParallax` helper that eases the camera toward the pointer. |
| `z-[4]`   | Amber color-graded lens (Halo-3-style) — sits over the 3D scene to push contrast down behind white text. |
| `z-[5]`   | Atmospheric warm/cool radial wash + top/bottom dark gradient.              |
| `z-10`    | `<main>` — scrolling sections (`Hero`, `Dossier`, `Capabilities`, `Archive`, `Telemetry`, `Eof`). Held at `opacity: 0` until `BootSequence` signals complete. |
| `z-40`    | `TopChrome` / `BottomChrome` persistent HUD frame.                         |
| `z-[60]`  | Scanlines / vignette / flicker overlay.                                    |
| `z-[100]` | `BootSequence` overlay (gates first paint).                                |

The amber lens (`z-[4]`) and atmospheric gradient (`z-[5]`) both live in `ScreenOverlays.tsx`. When adjusting overlay opacity, keep the amber lens stronger than the atmospheric — that's what gives white HUD copy enough contrast over the 3D scene.

`BootSequence` gates first paint of content; it is skipped automatically when `usePrefersReducedMotion()` returns true. Any new animation work should also respect `reducedMotion` — the 3D scene already omits `AmbientDust` and the pointer parallax in that mode.

### Directory conventions

- `src/scene/` — R3F scene graph children (Three.js / drei). Anything that renders inside `<Canvas>` lives here.
- `src/components/hud/` — reusable HUD primitives (`Panel`, `AngularButton`, `CornerBrackets`, `SectionHeading`, `HologramPortrait`). These apply the angular clip-paths from `src/lib/tokens.ts`.
- `src/components/chrome/`, `components/overlays/`, `components/boot/`, `components/text/` — non-reusable layout/FX pieces.
- `src/sections/` — one file per scrollable page section; these compose `hud/` primitives with data from `src/data/portfolio.ts`.
- `src/hooks/` — `useClock` (live UTC/local time ticker for the chrome), `useOnScreen` (IntersectionObserver), `usePrefersReducedMotion`, `useSignalStrength` (network-quality signal-strength bar driven by `navigator.connection`).
- `src/data/portfolio.ts` — single source of truth for all content (operative profile, bio, skills, projects, socials). Edit content here rather than in section components.
- `src/data/wakatime.generated.ts` — **auto-generated, gitignored**. Produced by `scripts/fetch-wakatime.mjs` on `predev` / `prebuild`; exports `telemetryBars` (top 5 languages + Other), `telemetryTiles` (avg/day, peak, streak), `telemetryHeatmap` (365-day activity grid with quartile-bucketed levels 0-4), and `telemetryYearTiles` (year total, top language, best day). `portfolio.ts` re-exports all four so section code keeps a single import site. Run `npm run wakatime` to regenerate on demand.

### Design tokens

Colors and clip-paths are defined **twice** and must stay in sync:

- `src/lib/tokens.ts` — `colors` and `clipPaths` used from JS/TSX (R3F materials, inline styles, data files).
- `src/styles/index.css` — the same palette mirrored under Tailwind v4's `@theme` block as `--color-*` custom properties, which is what generates utilities like `bg-panel`, `text-amber`, `border-line`, etc.

When adding a color, add it to both places using the same name (kebab-case in CSS, camelCase in TS). Typography tokens (`--font-display`, `--font-body`, `--font-mono` → Orbitron / Rajdhani / Share Tech Mono) live only in CSS.

### Path alias

`@/*` → `./src/*`, configured in both `tsconfig.app.json` (for TS resolution) and `vite.config.ts` (for bundling). Use `@/...` for all intra-src imports.

### Bundle splitting

`vite.config.ts` manually chunks `three` and `@react-three/fiber` + `@react-three/drei` into separate vendor chunks — the R3F stack is ~the largest dependency and benefits from its own cacheable chunk. Preserve this split when touching build config.

## Deployment

Netlify, configured in `netlify.toml`:

- `publish = "dist"`, `NODE_VERSION = "20"`.
- A strict CSP is enforced via response headers. New external origins (fonts, images, scripts, media, frames) must be explicitly added to the relevant `*-src` directive or they will be blocked in production but fine in dev. Notable allow-listed origins: `cdn.jsdelivr.net`, `fonts.g{oogleapis,static}.com`, `d33wubrfki0l68.cloudfront.net`, `wakatime.com`, `*.netlify.com`.
- `weion.netlify.app` 301s to `https://weion.dev`. There is also a SPA-style `public/_redirects`.
- `/assets/*` is served with a 1-year immutable cache, so Vite's hashed asset filenames must not be bypassed.

### WakaTime integration

- `WAKATIME_API_KEY` (Netlify site env var) drives `scripts/fetch-wakatime.mjs`. With the key present the script hits four endpoints in parallel:
  - `/users/current/stats/last_7_days` — languages + `daily_average` + `best_day`
  - `/users/current/summaries?range=last_30_days` — for the consecutive-day streak
  - `/users/current/stats/last_year` — top language for the year tile
  - `/users/current/summaries?start=…&end=…` (365-day window) — for the year heatmap and year totals (the `range=last_year` shortcut is rejected by the summaries endpoint, so explicit dates are required)
- **Fallback behavior**: if anything fails (missing key, malformed key, network/API error, empty response), the script does **not** write fake data. Instead it preserves the existing `wakatime.generated.ts` from the previous deploy, logging the reason. Only when no prior file exists does it write a minimal empty bootstrap so tsc/Vite can still compile.
- The "preserve existing" path requires the file to survive across deploys. Since it's gitignored, `netlify-plugin-cache` is registered in `netlify.toml` to persist `src/data/wakatime.generated.ts` between builds. On the very first deploy the cache is empty and the script must successfully fetch.
- Freshness is tied to deploy cadence. The scheduled Netlify function in `netlify/functions/trigger-rebuild.mjs` runs `@daily` and POSTs to the site's build hook (URL stored in the `BUILD_HOOK_URL` Netlify env var) so each deploy regenerates the telemetry. Don't add runtime fetching.
- The script is deliberately dependency-free — it uses `fetch` built into Node 20+ and nothing from `node_modules`. Keep it that way; a stale lockfile shouldn't be able to break telemetry generation.

## Code style — Biome

`biome.json` configures Biome 2 as the single linter + formatter (no ESLint, no Prettier). Style: 2-space indent, single JS quotes / double JSX quotes, semis required, trailing commas, 100-col line width, LF endings. Respects `.gitignore` via `vcs.useIgnoreFile`.

Notable explicit configuration:

- `**/*.css` is excluded — Biome's CSS parser doesn't understand Tailwind v4's `@theme` directive, and the only `noImportantStyles` violations are the intentional `animation: none !important` overrides inside `@media (prefers-reduced-motion)`.
- `lint/suspicious/noCommentText: off` — the `//` glyph is part of the HUD design language and appears as literal text in section eyebrows (`// OPERATOR PROFILE`, `WEION.DEV //`, etc.); the rule misreads them as stray comments.
- `assets/`, `dist/`, `.vite/`, and `src/data/wakatime.generated.ts` are excluded from `files.includes`.

Per-line `// biome-ignore lint/<rule>: <reason>` suppressions exist in three known places — all intentional patterns (R3F stable uniform identity, presentational hover wrapper, heatmap padding cells). Don't remove them without addressing the underlying pattern.

## Documentation

Every exported symbol in `src/**/*.{ts,tsx}` carries TSDoc. Style: brief one-line summary, `@remarks` for non-obvious design decisions / coordination notes, `@example` taken from real call sites, `@defaultValue` for optional props with defaults, `{@link OtherName}` cross-references. Internal helpers only get TSDoc when the behavior isn't obvious from the code. Keep this style when adding new exports — see `src/scene/AmbientDust.tsx` and `src/components/hud/AngularButton.tsx` as canonical references.
