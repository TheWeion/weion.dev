# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal portfolio site (weion.dev) for Terry Fallows. Single-page app with a WebGL-driven "HUD / operator console" aesthetic. Vite + React 19 + TypeScript + React Three Fiber, styled with Tailwind v4, deployed on Netlify. Node 24 (see `.nvmrc`).

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
```

There is no test suite. `npm run build` deliberately runs TypeScript as a project-reference build (`tsc -b`) before Vite, so a type error fails the Netlify build even though Vite itself would transpile through SWC.

## Architecture

### Rendering layers (see `src/App.tsx`)

The page is a stack of fixed/absolute layers, not a normal document flow. Z-indices are intentional and form the layer ordering:

| z-index   | Layer                                                                      |
| --------- | -------------------------------------------------------------------------- |
| `z-0`     | `HudScene` (R3F `<Canvas>`) — `Lights`, `HoloOrb` (Goldberg-polyhedron wireframe shell + holographic core), `AmbientDust`, `GridFloor`, plus a `CameraParallax` helper that eases the camera toward the pointer. Lazy-loaded from `App.tsx` via `React.lazy` + `<Suspense>` so the ~335 KiB three+r3f stack stays off the critical path. **The mount is also gated by `booted` (`{booted && ...}`)** so three.js doesn't even *start* downloading/parsing until the boot animation finishes — on weak GPUs (Intel UHD 600 etc.) the ~1.2 MB three+r3f parse would otherwise block the boot timers and leave the terminal stuck empty. Wrapped in `SceneErrorBoundary` so a WebGL/postprocessing failure degrades to "no 3D background" instead of unmounting the rest of the app. |
| `z-[4]`   | Amber color-graded lens (Halo-3-style) — sits over the 3D scene to push contrast down behind white text. |
| `z-[5]`   | Atmospheric warm/cool radial wash + top/bottom dark gradient.              |
| `z-10`    | `<main>` — scrolling sections (`Hero`, `Dossier`, `Capabilities`, `Archive`, `Telemetry`, `Eof`). Held at `opacity: 0` until `BootSequence` signals complete. |
| `z-40`    | `TopChrome` / `BottomChrome` persistent HUD frame.                         |
| `z-[60]`  | Scanlines / vignette / flicker overlay.                                    |
| `z-[80]`  | `VideoFeedModal` when open — above chrome and FX but below the boot curtain. |
| `z-[100]` | `BootSequence` overlay (gates first paint).                                |

The amber lens (`z-[4]`) and atmospheric gradient (`z-[5]`) both live in `ScreenOverlays.tsx`. When adjusting overlay opacity, keep the amber lens stronger than the atmospheric — that's what gives white HUD copy enough contrast over the 3D scene.

`BootSequence` gates first paint of content; it is skipped automatically when `usePrefersReducedMotion()` returns true. Any new animation work should also respect `reducedMotion` — the 3D scene already omits `AmbientDust` and pointer parallax in that mode, **and** `<Canvas>` switches to `frameloop="demand"` permanently so the WebGL render loop doesn't run at all.

`HudScene` also defers `frameloop="always"` for non-reduced-motion users until the first user signal (pointermove/scroll/touchstart/keydown) or a 2.05 s fallback. This was originally a Lighthouse-driven optimisation (the always-on render loop dominated TBT/TTI) but it also gives the page a quieter first second on real users. `CameraParallax` is hover-only — it skips the `pointermove` listener on touch-only devices (`(hover: hover)` query) and ignores `pointerType === 'touch'` on hybrid devices, so mobile scrolls don't drag the camera.

### Static boot placeholder

`index.html` ships with `<body style="overflow:hidden">` plus a fixed-position `<div>` inside `#root` that mirrors the first BootSequence line ("> INITIATING REMOTE LINK ........"). Two reasons:

- **FCP** — the browser paints contentful pixels on HTML parse, before the JS bundle has to download/parse/execute on a throttled mobile CPU. React then overwrites the placeholder when it mounts.
- **Scroll lock** — locked from the HTML so the user can't scroll past the placeholder before React mounts. `BootSequence` releases it via a `done` state set when `onComplete` fires (or immediately when `skip` is true).

If you change the placeholder visual, keep it close to the React-rendered BootSequence — large CLS regressions show up here when the dimensions diverge.

### Directory conventions

- `src/scene/` — R3F scene graph children (Three.js / drei). Anything that renders inside `<Canvas>` lives here. Pure utilities used by scene children also live here, e.g. `goldbergGeometry.ts` builds the dual-polyhedron line geometry consumed by `HoloOrb`'s outer hex shell.
- `src/components/hud/` — reusable HUD primitives (`Panel`, `AngularButton`, `CornerBrackets`, `SectionHeading`, `HologramPortrait`). These apply the angular clip-paths from `src/lib/tokens.ts`.
- `src/components/chrome/`, `components/overlays/`, `components/boot/`, `components/text/` — non-reusable layout/FX pieces.
- `src/components/SceneErrorBoundary.tsx` — class-component error boundary scoped to the lazy `HudScene` mount. Catches WebGL/postprocessing failures (older Intel iGPUs, blocked hardware acceleration, lost context) so they degrade to "no 3D background" rather than unmounting the whole React tree.
- `src/sections/` — one file per scrollable page section; these compose `hud/` primitives with data from `src/data/portfolio.ts`.
- `src/hooks/` — `useClock` (live UTC/local time ticker for the chrome), `useOnScreen` (IntersectionObserver), `usePrefersReducedMotion`, `useSignalStrength` (network-quality signal-strength bar driven by `navigator.connection`), `useWakatime` (runtime fetch of WakaTime share-chart JSON, with hex→sci-fi palette mapping).
- `src/data/portfolio.ts` — single source of truth for all content (operative profile, bio, skills, projects, socials). Edit content here rather than in section components.

### Design tokens

Colors and clip-paths are defined **twice** and must stay in sync:

- `src/lib/tokens.ts` — `colors` and `clipPaths` used from JS/TSX (R3F materials, inline styles, data files).
- `src/styles/index.css` — the same palette mirrored under Tailwind v4's `@theme` block as `--color-*` custom properties, which is what generates utilities like `bg-panel`, `text-amber`, `border-line`, etc.

When adding a color, add it to both places using the same name (kebab-case in CSS, camelCase in TS). Typography tokens (`--font-display`, `--font-body`, `--font-mono` → Orbitron / Rajdhani / Share Tech Mono) live only in CSS. The fonts themselves are bundled via `@fontsource/*` packages — imports live at the top of `src/main.tsx`. Add a new weight by importing its `latin-<weight>.css` file there; Vite hashes the woff2 under `/assets/`.

### Path alias

`@/*` → `./src/*`, configured in both `tsconfig.app.json` (for TS resolution) and `vite.config.ts` (for bundling). Use `@/...` for all intra-src imports.

### Bundle splitting and build-time HTML transforms

`vite.config.ts` manually chunks `three`, `@react-three/fiber` + `@react-three/drei`, and `@react-three/postprocessing` + `postprocessing` into separate vendor chunks — the R3F stack is ~the largest dependency and benefits from its own cacheable chunks. `HudScene` is a separate chunk too because `App.tsx` lazy-imports it. Preserve all of these splits when touching build config.

Two custom in-config Vite plugins run during `vite build`:

- `preloadCriticalFonts` — scans the bundle for woff2 assets matching `rajdhani-latin-400` and `orbitron-latin-700` and injects `<link rel="preload" as="font">` tags so the browser fetches them in parallel with the inlined CSS.
- `inlineAppStylesheet` — replaces the `<link rel="stylesheet" href="...index-*.css">` in `index.html` with a `<style>` block containing the file contents. Eliminates the only render-blocking subresource. Requires `style-src 'unsafe-inline'` in the production CSP — see `netlify.toml`.

`build.sourcemap` is enabled in production so the best-practices source-map audit passes and crash reports are debuggable.

## Deployment

Netlify, configured in `netlify.toml`:

- `publish = "dist"`, `NODE_VERSION = "24"`.
- A strict CSP is enforced via response headers. New external origins (fonts, images, scripts, media, frames) must be explicitly added to the relevant `*-src` directive or they will be blocked in production but fine in dev. Notable allow-listed origins: `cdn.jsdelivr.net`, `d33wubrfki0l68.cloudfront.net`, `wakatime.com`, `*.netlify.com`. Webfonts are self-hosted via `@fontsource/*` packages and ship from same-origin under `/assets/`. `style-src` carries `'unsafe-inline'` because the build pipeline inlines the app stylesheet into `index.html` (and React inline-style attributes were already implicitly relying on it); leave it unless you switch to a nonce/hash strategy.
- `public/robots.txt` exists so the SPA fallback in `public/_redirects` doesn't serve `index.html` for `/robots.txt` and fail the Lighthouse SEO audit. Same applies if you ever add `/sitemap.xml` — must be a real file under `public/`, not a SPA-fallback HTML page.
- `weion.netlify.app` 301s to `https://weion.dev`. There is also a SPA-style `public/_redirects`.
- `/assets/*` is served with a 1-year immutable cache, so Vite's hashed asset filenames must not be bypassed.

### WakaTime integration

- `src/hooks/useWakatime.ts` fetches three public WakaTime share-chart JSON URLs in parallel from the browser on mount of `TelemetrySection`:
  - Daily-activity (last 30 days) → drives the audio-waveform visualization plus the AVG/DAY, PEAK, and STREAK tiles.
  - Language distribution (last 30 days) → drives the language bars and the year-panel TOP LANG tile. Recognizable brand colors (HSL saturation ≥ 10%) keep their hue but get clamped into the HUD's "neon accent" S/L range (saturation ≥ 80%, lightness in `[0.50, 0.65]`) via `sciFiTune` — so TypeScript stays blue, JavaScript stays yellow, but both pop against the dark panel like the rest of the cyan/amber/magenta palette. Monochrome languages (JSON's `#292929`, plain-text grays) fall back to a sci-fi token from `@/lib/tokens` by lightness: dark → `bronze`, light → `halo`, mid → `muted`.
  - Activity (last 365 days) → drives the heatmap (quartile-bucketed levels 0-4) and the TOTAL / BEST DAY tiles.
- No API key, no `.env`, and no build-time generation step — WakaTime refreshes the share JSON daily on their side, so freshness rides on the user's page visit. CSP `connect-src` includes `wakatime.com` to allow the three browser fetches.
- On fetch failure the hook surfaces an `error` and leaves `data` `null`; the section renders empty panels rather than fakes. The TelemetrySection layout reserves space for the visualizations so the loading state doesn't shift layout.

## Code style — Biome

`biome.json` configures Biome 2 as the single linter + formatter (no ESLint, no Prettier). Style: 2-space indent, single JS quotes / double JSX quotes, semis required, trailing commas, 100-col line width, LF endings. Respects `.gitignore` via `vcs.useIgnoreFile`.

Notable explicit configuration:

- `**/*.css` is excluded — Biome's CSS parser doesn't understand Tailwind v4's `@theme` directive, and the only `noImportantStyles` violations are the intentional `animation: none !important` overrides inside `@media (prefers-reduced-motion)`.
- `lint/suspicious/noCommentText: off` — the `//` glyph is part of the HUD design language and appears as literal text in section eyebrows (`// OPERATOR PROFILE`, `WEION.DEV //`, etc.); the rule misreads them as stray comments.
- `assets/`, `dist/`, and `.vite/` are excluded from `files.includes`.

Per-line `// biome-ignore lint/<rule>: <reason>` suppressions exist in three known places — all intentional patterns (R3F stable uniform identity, presentational hover wrapper, heatmap padding cells). Don't remove them without addressing the underlying pattern.

## Documentation

Every exported symbol in `src/**/*.{ts,tsx}` carries TSDoc. Style: brief one-line summary, `@remarks` for non-obvious design decisions / coordination notes, `@example` taken from real call sites, `@defaultValue` for optional props with defaults, `{@link OtherName}` cross-references. Internal helpers only get TSDoc when the behavior isn't obvious from the code. Keep this style when adding new exports — see `src/scene/AmbientDust.tsx` and `src/components/hud/AngularButton.tsx` as canonical references.
