# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal portfolio site (weion.dev) for Terry Fallows. Single-page app with a WebGL-driven "HUD / operator console" aesthetic. Vite + React 19 + TypeScript + React Three Fiber, styled with Tailwind v4, deployed on Netlify. Node 24 (see `.nvmrc`).

## Commands

```bash
yarn dev           # Vite dev server on :5173 (host: true — accessible on LAN)
yarn build         # tsc -b (project references) + vite build -> dist/
yarn preview       # Serve the built dist/ locally
yarn typecheck     # tsc -b --noEmit (no bundle)
yarn lint          # biome lint
yarn format        # biome format --write
yarn format:check  # biome format (no writes)
yarn check         # biome check (lint + format + import sort)
yarn check:fix     # biome check --write (the daily driver)
```

Yarn 4 (Berry) is the package manager. The runner binary is committed at `.yarn/releases/yarn-4.14.1.cjs` and selected via `yarnPath` in `.yarnrc.yml`, so Netlify (and any fresh checkout) runs Yarn 4 without needing Corepack or a separate install step. `nodeLinker: node-modules` is set so installs produce a conventional `node_modules/` tree — no PnP. The committed binary is needed because the canonical Yarn CDN at `repo.yarnpkg.com` currently returns 404 for the per-version `yarn.js` URLs; keep the binary checked in until that's fixed upstream.

There is no test suite. `yarn build` deliberately runs TypeScript as a project-reference build (`tsc -b`) before Vite, so a type error fails the Netlify build even though Vite itself would transpile through Oxc.

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
| `z-[80]`  | `HudModal` dialogs when open (`VideoFeedModal`, the dossier record modal) — above chrome and FX but below the boot curtain. |
| `z-[100]` | `BootSequence` overlay (gates first paint).                                |

The amber lens (`z-[4]`) and atmospheric gradient (`z-[5]`) both live in `ScreenOverlays.tsx`. When adjusting overlay opacity, keep the amber lens stronger than the atmospheric — that's what gives white HUD copy enough contrast over the 3D scene.

`BootSequence` gates first paint of content; it is skipped automatically when `usePrefersReducedMotion()` returns true. Any new animation work should also respect `reducedMotion` — the 3D scene already omits `AmbientDust` and pointer parallax in that mode, **and** `<Canvas>` switches to `frameloop="demand"` permanently so the WebGL render loop doesn't run at all.

`HudScene` starts its `frameloop="always"` immediately on mount for non-reduced-motion users. The earlier user-signal + 2.05 s fallback defer was a Lighthouse trick from when HudScene mounted at page load; now that `App` gates the mount behind `booted` (a 2.7 s boot animation has already played by then), the user is demonstrably present and the canvas can come alive right away. To bridge the chunk-load gap between boot end and scene appearance, `App` pre-warms the `@/scene/HudScene` chunk on a 2 s timer (matching the boot fade) so three.js is downloaded *and parsed* by the time `booted` flips — without this, the scene would lag the boot end by ~500–1500 ms. `CameraParallax` is hover-only — it skips the `pointermove` listener on touch-only devices (`(hover: hover)` query) and ignores `pointerType === 'touch'` on hybrid devices, so mobile scrolls don't drag the camera.

### Deep links

Inbound links like `https://weion.dev/#telemetry` or `https://weion.dev/?feed=01#archive` (the GitHub profile README uses both) play the boot and show the hero before moving. `captureDeepLink()` (`src/lib/deepLink.ts`) runs in `main.tsx` before React mounts, records the `#section` / `?feed=` target and strips them from the URL — otherwise the browser jumps to the fragment behind the boot curtain. `useDeepLink` (`src/hooks/useDeepLink.ts`) waits for `booted`, holds on the hero for `HERO_HOLD_MS`, smooth-scrolls to the section, restores `#section` in the URL, then returns the feed id, which `App` passes to `ArchiveSection`'s `openFeedId` to open that project's `VideoFeedModal`. `?feed` alone implies `#archive`; ids without a `preview` are ignored. Reduced motion skips the hold and jumps instantly. Section ids are `dossier`, `systems`, `archive`, `telemetry`, `eof` — renaming one breaks external links.

### Static boot placeholder

`index.html` ships with `<body style="overflow:hidden">` plus a fixed-position `<div>` inside `#root` that mirrors the first BootSequence line ("> INITIATING REMOTE LINK ........"). Two reasons:

- **FCP** — the browser paints contentful pixels on HTML parse, before the JS bundle has to download/parse/execute on a throttled mobile CPU. React then overwrites the placeholder when it mounts.
- **Scroll lock** — locked from the HTML so the user can't scroll past the placeholder before React mounts. `BootSequence` releases it via a `done` state set when `onComplete` fires (or immediately when `skip` is true).

If you change the placeholder visual, keep it close to the React-rendered BootSequence — large CLS regressions show up here when the dimensions diverge.

### Directory conventions

- `src/scene/` — R3F scene graph children (Three.js / drei). Anything that renders inside `<Canvas>` lives here. Pure utilities used by scene children also live here, e.g. `goldbergGeometry.ts` builds the dual-polyhedron line geometry consumed by `HoloOrb`'s outer hex shell.
- `src/components/hud/` — reusable HUD primitives (`Panel`, `AngularButton`, `CornerBrackets`, `SectionHeading`, `HologramPortrait`, `HudModal` — the shared sci-fi dialog shell with focus trap, `inert` background, and scroll lock). These apply the angular clip-paths from `src/lib/tokens.ts`.
- `src/components/chrome/`, `components/overlays/`, `components/boot/`, `components/text/` — non-reusable layout/FX pieces.
- `src/components/SceneErrorBoundary.tsx` — class-component error boundary scoped to the lazy `HudScene` mount. Catches WebGL/postprocessing failures (older Intel iGPUs, blocked hardware acceleration, lost context) so they degrade to "no 3D background" rather than unmounting the whole React tree.
- `src/sections/` — one file per scrollable page section; these compose `hud/` primitives with data from `src/data/portfolio.ts`.
- `src/hooks/` — `useClock` (live UTC/local time ticker for the chrome), `useOnScreen` (IntersectionObserver), `usePrefersReducedMotion`, `useSignalStrength` (network-quality signal-strength bar driven by `navigator.connection`), `useOccasion` / `useOccasionTransition` (see Occasion easter eggs), `useWakatime` (runtime fetch of WakaTime share-chart JSON, with hex→sci-fi palette mapping).
- `src/content/*.json` — all site content (profile/bio/socials, experience, education, skills, projects), edited through **Pages CMS** (`.pages.yml` at the repo root; edits at app.pagescms.org commit straight to the repo and trigger a Netlify rebuild). Excluded from Biome so CMS-written formatting doesn't fail `yarn check`. If you add or rename a field, update `.pages.yml`, the type in `src/types`, and the normalizer in `portfolio.ts` together.
- `src/data/portfolio.ts` — the typed layer over `src/content/`. Validates and normalizes the CMS output (blank strings → absent, blank `end` → `null`, half-filled `preview` rejected) and throws at module load on malformed content, which fails `yarn build` because `vite.config.ts` imports it. Sections import from here, never from the JSON directly. Its JSON imports are relative (`../content/...`), not `@/`, because Vite loads the config before the alias applies.

### Design tokens

Colors and clip-paths are defined **twice** and must stay in sync:

- `src/lib/tokens.ts` — `colors` and `clipPaths` used from JS/TSX (R3F materials, inline styles, data files).
- `src/styles/index.css` — the same palette mirrored under Tailwind v4's `@theme` block as `--color-*` custom properties, which is what generates utilities like `bg-panel`, `text-amber`, `border-line`, etc.

When adding a color, add it to both places using the same name (kebab-case in CSS, camelCase in TS). Typography tokens (`--font-display`, `--font-body`, `--font-mono` → Orbitron / Rajdhani / Share Tech Mono) live only in CSS. The fonts themselves are bundled via `@fontsource/*` packages — imports live at the top of `src/main.tsx`. Add a new weight by importing its `latin-<weight>.css` file there; Vite hashes the woff2 under `/assets/`.

### Path alias

`@/*` → `./src/*`, configured in both `tsconfig.app.json` (for TS resolution) and `vite.config.ts` (for bundling). Use `@/...` for all intra-src imports.

### Bundle splitting and build-time HTML transforms

`vite.config.ts` manually chunks (Rolldown `build.rolldownOptions.output.codeSplitting.groups` — Vite 8 dropped the object-form `manualChunks`) `three`, `@react-three/fiber` + `@react-three/drei`, and `@react-three/postprocessing` + `postprocessing` into separate vendor chunks — the R3F stack is ~the largest dependency and benefits from its own cacheable chunks. `HudScene` is a separate chunk too because `App.tsx` lazy-imports it. Preserve all of these splits when touching build config.

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
- `.github/workflows/notify-profile.yml` fires a `repository_dispatch` (`weion-content-updated`, with the commit SHA) at `TheWeion/TheWeion` whenever `src/content/**` changes on `main`, so the generated GitHub profile README rebuilds from the new CMS content immediately. Needs the `PROFILE_DISPATCH_TOKEN` repo secret (fine-grained PAT, `TheWeion/TheWeion` only, Contents: read and write); without it the step warns and the profile's hourly sync catches up instead.

### Scheduled publishing (Pages CMS)

Pages CMS commits straight to `main` and can't schedule, so every CMS page has an optional **Publish at** date (`publish_at`: top-level in `profile.json`/`skills.json`, per item in the list files). `.github/workflows/scheduled-publish.yml` runs `scripts/scheduled-publish.mjs run` on content pushes and every 15 min (`4,19,34,49 * * * *`):

- A file on `main` with a non-empty `publish_at` is taken back off `main` (restored to its last version without a date) and re-applied, date blanked, on `scheduled/<UTC time>` (e.g. `scheduled/2026-11-01T09-00Z`) with its own PR, labelled `scheduled-publish`. A later save for the same minute is 3-way merged onto that branch, so one PR collects them. The `main` change and the branches go up in one atomic push. A clash fails the run and comments on the PR. Dates already past are just blanked on `main` and go live.
- The date is wall time in `operative.timezone`. Several dates in one save → the latest wins. The PR body holds `<!-- scheduled-publish-at: <ISO> -->`, which is what the cron reads. Due PRs are merged (squash; `SCHEDULED_MERGE_METHOD` overrides) and their branch deleted. If a merge fails, the run comments once and leaves the PR open. Closing the PR cancels it.
- `.pages/scheduled.json` (CMS page "Scheduled updates", a read-only `rich-text` HTML field) is rewritten every run with links to the open scheduled PRs. It is written exactly as Pages CMS writes JSON (`JSON.stringify(…, null, 2)`, no trailing newline) and is excluded from Biome so nothing reformats it.
- The edit must not go live during the short time it sits on `main`, so there are three guards: `netlify.toml`'s `ignore = "node scripts/scheduled-publish.mjs netlify-ignore"` skips that build (and builds that only touch `.pages/`). `portfolio.ts`'s `assertNotScheduled` fails any build that still sees a date. `notify-profile.yml` skips the profile dispatch (`scheduled-publish.mjs pending`). Only the profile README's own hourly sync can still catch it in that window.
- Runs as `github-actions[bot]` with the built-in `GITHUB_TOKEN` (no App or PAT; the Pages CMS bot's token never reaches Actions). Opening PRs needs "Allow GitHub Actions to create and approve pull requests" in the repo's Actions settings. `GITHUB_TOKEN` pushes don't start workflows, so the script dispatches `notify-profile.yml` itself after publishing (Netlify still builds on every push). If `main` gets branch protection, Actions must be allowed to push to it.
- `publish_at` isn't site content: `portfolio.ts` only checks that it's blank and has no type for it. If you add a content file, give it the `publish_at` field in `.pages.yml` too.

### Occasion easter eggs

- `HologramPortrait` re-themes on calendar occasions via `useOccasion` (`src/hooks/useOccasion.ts`): birthday, Easter (Good Friday–Easter Monday, computed per year), Halloween (25–31 Oct), Christmas (20–26 Dec). Windows live in `src/lib/occasions.ts`; dates resolve in `operative.timezone`; the birthday wins on overlap. Everything runs client-side with no network requests and re-checks once a minute so the theme flips at midnight.
- Visuals are in `src/components/hud/hologramOccasions.tsx`: `OCCASION_THEMES` (tint palette, accent, label strip, particle config), `OccasionProp` (party / witch / Santa hat anchored via `HAT_ANCHOR` in texture UVs — update it if `hero-hologram.webp` changes — or an orbiting Easter egg), and `OccasionParticles`. Props are children of the portrait mesh so they sway with the head. Occasion colours are local constants, not design tokens. Prop palettes must stay module-level constants: `HoloSurface` memoizes uniforms on palette identity, and its uniforms are driven through `matRef` because R3F doesn't preserve the `uniforms` prop's identity.
- The birthday comes from `OPERATIVE_DOB` (Netlify build env var, `YYYY-MM-DD` or `MM-DD`; set it as a secret using the full `YYYY-MM-DD` so secret scanning can't false-positive on short `MM-DD` strings in the bundle). It is deliberately **not** in the CMS: the repo is public and Pages CMS commits fields into `src/content/`. `vite.config.ts` hashes only the month-day (salted SHA-256 via `birthdayDigestInput` in `src/lib/birthday.ts`) into the `__BIRTHDAY_HASH__` define; the raw date never reaches the bundle. Unset → no birthday. Malformed → build fails. 366 possible inputs means this is obfuscation, not secrecy.
- The background orb re-themes too: `src/scene/OccasionCore.tsx` swaps `HoloOrb`'s inner core for the Portal cake / pumpkin / painted egg / snowman's head. Cores render outside the orb's spinning shell group so faces can stay toward the camera.
- Both consumers go through `useOccasionTransition` (`src/hooks/useOccasionTransition.ts`), never `useOccasion` directly: the default shows first, then after a `hold` it glitches into the occasion (and back out if the occasion ends mid-visit). The portrait's `active` prop (fed from `App`'s `booted` via `HeroSection`) keeps the hold from elapsing behind the boot curtain. Portrait glitch = `.hud-signal-glitch` CSS on the canvas wrapper + `GlitchText mode="burst" scramble` on the label; orb glitch = both cores mounted, visibility re-rolled every 50 ms in `useFrame`, plus core jitter and shell flicker. `OCCASION_GLITCH_MS` must match the `.hud-signal-glitch` duration in `index.css`. Reduced motion swaps instantly with no glitch.
- Dev preview: append `?occasion=birthday|easter|halloween|christmas`; add `&occasionFor=<seconds>` to end it after that long and preview the glitch back to default.

### WakaTime integration

- `src/hooks/useWakatime.ts` fetches three WakaTime share-chart JSON paths in parallel on mount of `TelemetrySection`, via the same-origin proxy at `/api/wakatime/share/@Weion/<uuid>.json`:
  - Daily-activity (last 30 days) → drives the audio-waveform visualization plus the AVG/DAY, PEAK, and STREAK tiles.
  - Language distribution (last 30 days) → drives the language bars and the year-panel TOP LANG tile. Recognizable brand colors (HSL saturation ≥ 10%) keep their hue but get clamped into the HUD's "neon accent" S/L range (saturation ≥ 80%, lightness in `[0.50, 0.65]`) via `sciFiTune` — so TypeScript stays blue, JavaScript stays yellow, but both pop against the dark panel like the rest of the cyan/amber/magenta palette. Monochrome languages (JSON's `#292929`, plain-text grays) fall back to a sci-fi token from `@/lib/tokens` by lightness: dark → `bronze`, light → `halo`, mid → `muted`.
  - Activity (last 365 days) → drives the heatmap (quartile-bucketed levels 0-4) and the TOTAL / BEST DAY tiles.
- `/api/wakatime/*` is fronted in production by a Netlify Edge Function at `netlify/edge-functions/wakatime.ts`. WakaTime's own response is dynamically generated and slow (~10-50 s TTFB) and returns `Cache-Control: no-cache, no-store`, which would otherwise make every cold visit re-pay the full latency. The edge function whitelists `/share/*` paths, fetches the upstream JSON, and replaces its cache headers with `Cache-Control: public, max-age=3600` + `Netlify-CDN-Cache-Control: public, durable, s-maxage=86400` so the Netlify edge serves subsequent requests in ~50 ms and the cache survives deploys (`durable`). The first visit per 24-h window warms the cache; everyone else is instant.
- In dev, Vite's `server.proxy` forwards `/api/wakatime/*` straight to `wakatime.com` so the hook's relative URLs work without an env branch. There's no caching layer in dev, so each `yarn dev` page load still pays WakaTime's full latency once.
- No API key, no `.env`, no build-time generation step. CSP `connect-src` no longer needs to allow `wakatime.com` — all fetches now go through the same-origin proxy.
- The hook surfaces `loading` and `error` alongside `data`; `TelemetrySection`'s `StatusLine` shows "FETCHING TELEMETRY ..." while in flight and "LINK SEVERED · DATA UNAVAILABLE" on failure so cold-cache loads and outages are obvious instead of rendering as silent empty panels. Layout reserves space for the visualizations so state transitions don't shift content.

## Code style — Biome

`biome.json` configures Biome 2 as the single linter + formatter (no ESLint, no Prettier). Style: 2-space indent, single JS quotes / double JSX quotes, semis required, trailing commas, 100-col line width, LF endings. Respects `.gitignore` via `vcs.useIgnoreFile`.

Notable explicit configuration:

- `**/*.css` is excluded — Biome's CSS parser doesn't understand Tailwind v4's `@theme` directive, and the only `noImportantStyles` violations are the intentional `animation: none !important` overrides inside `@media (prefers-reduced-motion)`.
- `lint/suspicious/noCommentText: off` — the `//` glyph is part of the HUD design language and appears as literal text in section eyebrows (`// OPERATOR PROFILE`, `WEION.DEV //`, etc.); the rule misreads them as stray comments.
- `assets/`, `dist/`, and `.vite/` are excluded from `files.includes`.

Per-line `// biome-ignore lint/<rule>: <reason>` suppressions exist in three known places — all intentional patterns (R3F stable uniform identity, presentational hover wrapper, heatmap padding cells). Don't remove them without addressing the underlying pattern.

## Documentation

Every exported symbol in `src/**/*.{ts,tsx}` carries TSDoc. Style: brief one-line summary, `@remarks` for non-obvious design decisions / coordination notes, `@example` taken from real call sites, `@defaultValue` for optional props with defaults, `{@link OtherName}` cross-references. Internal helpers only get TSDoc when the behavior isn't obvious from the code. Keep this style when adding new exports — see `src/scene/AmbientDust.tsx` and `src/components/hud/AngularButton.tsx` as canonical references.
