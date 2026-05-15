# weion.dev

Personal portfolio site for Terry Fallows. A single-page application built on **Vite + React 19 + TypeScript** with a WebGL-driven heads-up-display aesthetic rendered via **React Three Fiber**.

---

## Stack

| Layer | Library |
| --- | --- |
| Bundler / dev server | Vite 6 |
| Framework | React 19 (SWC transform) |
| Language | TypeScript 5 (strict) |
| 3D | Three.js + `@react-three/fiber` + `@react-three/drei` |
| Styling | Tailwind CSS v4 (CSS-first `@theme` config) |
| Icons | `lucide-react` |
| Lint + format | Biome 2 |
| Deployment | Netlify (static build) |

---

## Quick start

Node 24 is pinned in `.nvmrc` (and in `netlify.toml` for production builds). The dev/build scripts run on any Node ≥ 20, but use `nvm use` to match the deploy environment exactly.

```bash
npm install
npm run dev          # http://localhost:5173 (host: true — accessible on LAN)
npm run typecheck    # strict TS check, no emit
npm run build        # production bundle to ./dist
npm run preview      # serve ./dist locally

npm run check        # Biome lint + format + import sort (read-only)
npm run check:fix    # same, with safe auto-fixes applied
npm run format       # format only (writes)
npm run lint         # lint only
```

---

## Project layout

```
src/
├── main.tsx                       React entry point — wires @fontsource imports + dev-only web-vitals logger
├── App.tsx                        Root — composes layered z-stack, sections, boot; lazy-imports HudScene behind <Suspense>
├── styles/
│   └── index.css                  Tailwind v4 @theme tokens + HUD utilities
├── types/
│   └── index.ts                   TypeScript interfaces (Operative, Project, TelemetryBar, TelemetryHeatmapDay, PanelVariant)
├── data/
│   ├── portfolio.ts               All site content (bio, skills, projects, socials)
│   └── projects.json              Project entries consumed by portfolio.ts
├── lib/
│   ├── tokens.ts                  Colour + clip-path design tokens
│   └── reportVitals.ts            Web-vitals console logger (loaded only in dev via dynamic import)
├── hooks/
│   ├── useOnScreen.ts             IntersectionObserver one-shot trigger
│   ├── useClock.ts                Live UTC + local time ticker for the chrome
│   ├── usePrefersReducedMotion.ts OS Reduce-motion preference
│   ├── useSignalStrength.ts       navigator.connection-driven signal bars
│   └── useWakatime.ts             Runtime fetch of WakaTime share-chart JSON + hex→sci-fi palette mapping
├── scene/                         React Three Fiber modules
│   ├── HudScene.tsx               <Canvas> wrapper, fog, PerformanceMonitor, deferred-frameloop, hover-only CameraParallax, optional r3f-perf overlay
│   ├── HoloOrb.tsx                Holographic core + Goldberg-polyhedron hex shell + orbital rings
│   ├── HolographicMaterial.tsx    Custom shader material (fresnel rim + scrolling scanlines)
│   ├── goldbergGeometry.ts        Builds the dual-polyhedron line geometry for HoloOrb's hex shell
│   ├── AmbientDust.tsx            Animated point-sprite particle field
│   ├── GridFloor.tsx              drei <Grid> floor
│   └── Lights.tsx                 Ambient + key + fill point lights
├── components/
│   ├── boot/BootSequence.tsx      Terminal-style loading overlay (z-[100])
│   ├── chrome/
│   │   ├── TopChrome.tsx          Fixed status bar (top, z-40)
│   │   └── BottomChrome.tsx       Infinite skills marquee (bottom, z-40, two-copy seamless loop)
│   ├── hud/
│   │   ├── Panel.tsx              Beveled container with corner brackets
│   │   ├── CornerBrackets.tsx
│   │   ├── AngularButton.tsx      Cut-corner CTA
│   │   ├── HologramPortrait.tsx   3D-styled portrait card used by HeroSection
│   │   └── SectionHeading.tsx
│   ├── text/
│   │   ├── ScrambleText.tsx       Per-character scramble reveal
│   │   └── GlitchText.tsx         Chromatic-aberration text effect
│   └── overlays/
│       └── ScreenOverlays.tsx     Amber color-grade lens + atmospheric wash + scanlines/vignette/flicker
└── sections/                      One file per page section
    ├── HeroSection.tsx
    ├── DossierSection.tsx
    ├── CapabilitiesSection.tsx
    ├── ArchiveSection.tsx
    ├── TelemetrySection.tsx       Language bars + 30-day waveform + 365-day activity heatmap
    └── EofSection.tsx
```

All internal imports use the `@/` path alias (mapped to `./src` in `vite.config.ts` and `tsconfig.app.json`).

---

## Design tokens

The palette lives in two mirrored places:

1. **CSS** — `src/styles/index.css` defines Tailwind v4 theme colours under `@theme { ... }`, so you can write `bg-panel`, `text-amber`, `border-line` etc. directly in JSX.
2. **JS/TS** — `src/lib/tokens.ts` exports a typed `colors` object for inline `style={{ ... }}` usage (needed for shader uniforms, Three.js materials, gradients, and runtime colour math).

When you change a value, **update both** so JSX and 3D code stay consistent.

The three visual axes:

- **Atmospheric base** — deep desaturated blues (`--color-void`, `--color-panel`, `--color-halo`) for the ambient sci-fi tone.
- **Signal amber** — warm orange (`--color-amber`, `--color-amber-hot`) for active/interactive elements.
- **Glitch accents** — hot cyan and magenta (`--color-cyan`, `--color-magenta`) used for chromatic-aberration split on hero text.

---

## Reduced motion

`usePrefersReducedMotion()` returns `true` when the OS-level *Reduce motion* preference is set. When active:

- The boot sequence is skipped entirely (`onComplete` fires synchronously, body scroll lock releases immediately).
- Ambient dust particles are not rendered.
- Camera parallax is disabled (and on touch-only devices the parallax listener is never wired regardless of this flag — pointer parallax is fundamentally a hover interaction).
- The R3F `<Canvas>` switches to `frameloop="demand"` permanently, so the WebGL render loop doesn't run after the first paint.
- CSS keyframe animations are suppressed via the `@media (prefers-reduced-motion: reduce)` block at the bottom of `index.css`: marquee scroll, glitch split, radar rotate/sweep, CRT scanlines/sweep, and the global flicker.

Never remove this — it's an accessibility requirement, not an aesthetic toggle. Any new animation work should also respect `reducedMotion`.

---

## Performance notes

### Critical-path
- `HudScene` is `React.lazy`'d in `App.tsx`, so the ~335 KiB three+r3f+drei+postprocessing stack ships in its own chunks and stays off the critical path. The mount is additionally gated behind `booted` so the lazy import doesn't *fire* until after the boot animation finishes — on weak GPUs (Intel UHD 600 in older budget laptops) the ~1.2 MB three+r3f parse otherwise blocked the boot timers and left the terminal stuck empty.
- `HudScene` is wrapped in `SceneErrorBoundary` so a WebGL/postprocessing failure (older drivers, blocked hardware acceleration, lost context) degrades to a missing 3D background rather than unmounting the rest of the page.
- `index.html` carries a fixed-position static placeholder inside `#root` mirroring the first BootSequence line, so FCP fires on HTML parse instead of waiting for JS download/parse/execute. React replaces it on mount with the same visual.
- `<body style="overflow:hidden">` in `index.html` locks scroll until `BootSequence` releases it via its `done` state — covers the placeholder window before React mounts as well as the React-rendered overlay.
- The app stylesheet is **inlined** into `index.html` at build time by the `inlineAppStylesheet` Vite plugin so there is no render-blocking external CSS request.
- Critical webfont woff2 files (`Rajdhani-400`, `Orbitron-700`) are **preloaded** via `<link rel="preload" as="font">` injected by the `preloadCriticalFonts` Vite plugin, so the browser fetches them in parallel with the inlined CSS instead of waiting for CSS parse.

### Runtime
- The `<Canvas>` starts `frameloop="always"` immediately on mount for non-reduced-motion users — by then `booted` is true and the user has just watched 2.7 s of boot animation. Reduced-motion users stay in `frameloop="demand"` permanently.
- `App.tsx` pre-warms the HudScene chunk on a 2 s timer (matching the boot fade) so three.js is downloaded and parsed by the time `booted` flips, eliminating the ~500–1500 ms gap between boot end and the scene appearing. The preload is delayed deliberately so the heavy parse doesn't compete with the first 2 s of boot timers on weak hardware.
- `<Canvas>` pixel ratio is adaptive: it starts at `[1, 2]` and is stepped down to `[1, 1.5]` (medium) or `1` (low) at runtime by drei's `<PerformanceMonitor>`.
- All `useFrame` loops mutate refs directly; no `setState` inside the frame loop.
- Geometry, materials, and textures are created once inside `useMemo` or at module scope.

### Bundling and caching
- `three`, `@react-three/fiber` + `@react-three/drei`, and `@react-three/postprocessing` + `postprocessing` each get their own cacheable vendor chunk via `vite.config.ts` → `manualChunks`. `HudScene` produces its own chunk too, automatically, because `App.tsx` lazy-imports it.
- Webfonts are self-hosted via `@fontsource/*` packages and ship under `/assets/`, inheriting the long-cache header below.
- Static assets in `/assets/` are cached aggressively via `netlify.toml` (`Cache-Control: public, max-age=31536000, immutable`).
- Production source maps are emitted (`build.sourcemap: true`) so crash reports stay debuggable and the Lighthouse "missing source maps" best-practices audit passes.

### Diagnostics
- Append `?perf` to any URL to mount the `r3f-perf` overlay (FPS, GPU memory, draw calls). Resolved at module load — toggling requires a reload, so the overlay stays out of every render path for normal visits.
- Web-vitals (CLS / INP / LCP / FCP / TTFB) are logged to the console **in dev only** via a dynamic import gated on `import.meta.env.DEV`. Vite drops both the wrapper and the `web-vitals` package from the production bundle as dead code.

### 3D quality ladder

The scene reacts to sustained frame-rate drops so it stays responsive on weaker GPUs and under thermal throttling:

| Tier       | dpr cap    | Postprocessing                      | Ambient dust |
| ---------- | ---------- | ----------------------------------- | ------------ |
| **high**   | `[1, 2]`   | Bloom (0.9) + chromatic aberration  | on           |
| **medium** | `[1, 1.5]` | Bloom (0.6) + chromatic aberration  | on           |
| **low**    | `1`        | off                                 | off          |

The `HoloOrb` inner mesh uses a lightweight port of Anderson Mancini's [`HolographicMaterial`](https://github.com/ektogamat/threejs-holographic-material) (MIT) — fresnel rim + scrolling scanlines driven by world Y. The source lives at `src/scene/HolographicMaterial.tsx`.

---

## Deployment — Netlify

The project is configured for Netlify out-of-the-box:

- `netlify.toml` — build command, publish dir (`dist`), security headers, asset cache policy.
- `public/_redirects` — SPA fallback so client-side routes resolve to `index.html`.
- `public/robots.txt` — explicit file so crawlers don't pick up the SPA fallback for `/robots.txt`. Add a real `public/sitemap.xml` if the site ever grows past a single route — same gotcha applies.
- Node 24 is pinned via `.nvmrc` and `NODE_VERSION` in `netlify.toml`.
- A strict CSP is enforced via response headers. New external origins (fonts, images, scripts, media, frames) must be explicitly added to the relevant `*-src` directive. `style-src` carries `'unsafe-inline'` because the build pipeline inlines the app stylesheet into `index.html`; React inline-style attributes were already implicitly relying on it. `connect-src` includes `wakatime.com` so the `useWakatime` hook can fetch the public share-chart JSON at runtime.

Connect the repo in Netlify's UI and it will auto-detect Vite. On every push to `main`, Netlify runs:

```bash
npm install
npm run build
# publishes ./dist
```

The existing `weion.dev` custom domain and SSL are already configured in your Netlify dashboard — nothing to change there.

---

## WakaTime telemetry

The Telemetry section pulls real data from WakaTime **at runtime** in the browser via `src/hooks/useWakatime.ts`. It fetches three public share-chart JSON endpoints in parallel — no API key, no `.env`, no scheduled rebuild needed:

- **Daily activity (last 30 days)** — drives the audio-waveform visualization and the AVG/DAY, PEAK, and STREAK tiles.
- **Language distribution (last 30 days)** — drives the language bars and the year-panel TOP LANG tile.
- **Activity (last 365 days)** — drives the year heatmap (quartile-bucketed levels 0-4) and the TOTAL / BEST DAY tiles.

WakaTime refreshes the share JSON daily on their side, so freshness is tied to the user's visit rather than the deploy cadence. The CSP allows `wakatime.com` in `connect-src` for these browser fetches.

Recognizable brand colors (HSL saturation ≥ 10%) keep their hue but get clamped into the HUD's "neon accent" S/L range (saturation ≥ 80%, lightness in `[0.50, 0.65]`) via `sciFiTune` — so TypeScript stays blue and JavaScript stays yellow, but Markdown's dark navy lifts off the panel background and every bar carries the same vibrancy as the cyan/amber/magenta palette tokens. Monochrome languages (JSON's `#292929`, plain-text grays) fall back to a sci-fi token from `@/lib/tokens` chosen by lightness.

On fetch failure the hook surfaces an `error` and the section renders empty panels rather than fakes; the layout reserves space so the loading state doesn't shift content.

---

## Content

All copy, skills, and project data live in `src/data/portfolio.ts` (with project entries split out into `src/data/projects.json`). Edit those files to update anything visible — the components consume them reactively.

---

## Aesthetic

The HUD treatment takes generic sci-fi visual language — angular clip-path panels, corner brackets, rotating radar rings, scanlines, chromatic aberration, scrambled terminal text, amber-on-blue atmospheric lighting — without referencing any branded intellectual property.
