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

Node 20 or later is required (see `.nvmrc`).

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

npm run wakatime     # regenerate src/data/wakatime.generated.ts on demand
```

`predev` and `prebuild` automatically run `scripts/fetch-wakatime.mjs` so the generated telemetry module is always present before tsc/Vite read it.

---

## Project layout

```
src/
├── main.tsx                       React entry point
├── App.tsx                        Root — composes layered z-stack, sections, boot
├── styles/
│   └── index.css                  Tailwind v4 @theme tokens + HUD utilities
├── types/
│   └── index.ts                   TypeScript interfaces (Operative, Project, TelemetryBar, TelemetryHeatmapDay, PanelVariant)
├── data/
│   ├── portfolio.ts               All site content (bio, skills, projects, socials, telemetry re-exports)
│   ├── projects.json              Project entries consumed by portfolio.ts
│   └── wakatime.generated.ts      Auto-generated, gitignored — see scripts/fetch-wakatime.mjs
├── lib/
│   └── tokens.ts                  Colour + clip-path design tokens
├── hooks/
│   ├── useOnScreen.ts             IntersectionObserver one-shot trigger
│   ├── useClock.ts                Live UTC + local time ticker for the chrome
│   ├── usePrefersReducedMotion.ts OS Reduce-motion preference
│   └── useSignalStrength.ts       navigator.connection-driven signal bars
├── scene/                         React Three Fiber modules
│   ├── HudScene.tsx               <Canvas> wrapper, fog, PerformanceMonitor, CameraParallax
│   ├── HoloOrb.tsx                Layered holographic sphere + rings
│   ├── HolographicMaterial.tsx    Custom shader material (fresnel rim + scrolling scanlines)
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

scripts/
└── fetch-wakatime.mjs             Build-time WakaTime fetcher — runs on predev/prebuild
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

- The boot sequence is skipped entirely (`onComplete` fires synchronously).
- Ambient dust particles are not rendered.
- Camera parallax is disabled.
- CSS keyframe animations are suppressed via the `@media (prefers-reduced-motion: reduce)` block at the bottom of `index.css`: marquee scroll, glitch split, radar rotate/sweep, CRT scanlines/sweep, and the global flicker.

Never remove this — it's an accessibility requirement, not an aesthetic toggle. Any new animation work should also respect `reducedMotion`.

---

## Performance notes

- `<Canvas>` pixel ratio is adaptive: it starts at `[1, 2]` and is stepped down to `[1, 1.5]` (medium) or `1` (low) at runtime by drei's `<PerformanceMonitor>`.
- All `useFrame` loops mutate refs directly; no `setState` inside the frame loop.
- Geometry, materials, and textures are created once inside `useMemo` or at module scope.
- `three`, `@react-three/fiber` + `@react-three/drei`, and `@react-three/postprocessing` + `postprocessing` each get their own cacheable vendor chunk via `vite.config.ts` → `manualChunks`.
- Static assets in `/assets/` are cached aggressively via `netlify.toml` (`Cache-Control: public, max-age=31536000, immutable`).

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
- Node 20 is pinned via `.nvmrc` and `NODE_VERSION` in `netlify.toml`.
- A strict CSP is enforced via response headers. New external origins (fonts, images, scripts, media, frames) must be explicitly added to the relevant `*-src` directive.
- `netlify-plugin-cache` persists `src/data/wakatime.generated.ts` across deploys (it's gitignored), so the WakaTime script can fall back to last-known-good data when a fetch fails.

Connect the repo in Netlify's UI and it will auto-detect Vite. On every push to `main`, Netlify runs:

```bash
npm install
npm run build
# publishes ./dist
```

The existing `weion.dev` custom domain and SSL are already configured in your Netlify dashboard — nothing to change there.

---

## WakaTime telemetry

The Telemetry section pulls real data from WakaTime at build time. Set `WAKATIME_API_KEY` in Netlify's environment variables (a personal API key in the form `waka_<uuid>`) and `scripts/fetch-wakatime.mjs` will hit four endpoints in parallel:

- `/users/current/stats/last_7_days` — language bars + `daily_average` + `best_day`
- `/users/current/summaries?range=last_30_days` — for the consecutive-day streak
- `/users/current/stats/last_year` — top language for the year
- `/users/current/summaries?start=…&end=…` — 365 days, used for the activity heatmap and year totals

The script writes `src/data/wakatime.generated.ts` (gitignored) which exports `telemetryBars`, `telemetryTiles`, `telemetryHeatmap`, and `telemetryYearTiles`. `portfolio.ts` re-exports these so section code keeps a single import site.

If anything fails (missing key, network error, empty response), the script preserves the existing generated file rather than writing fakes — so a transient WakaTime outage doesn't degrade the live site. Only on the very first deploy with no cached file does it fall back to an empty bootstrap.

Refreshes happen on every deploy. To get continuously fresh numbers without a code push, add a Netlify scheduled build or a build hook fired on a cron.

Run `npm run wakatime` locally to regenerate on demand (requires the same env var, e.g. via `.env`).

---

## Content

All copy, skills, and project data live in `src/data/portfolio.ts` (with project entries split out into `src/data/projects.json`). Edit those files to update anything visible — the components consume them reactively.

---

## Aesthetic

The HUD treatment takes generic sci-fi visual language — angular clip-path panels, corner brackets, rotating radar rings, scanlines, chromatic aberration, scrambled terminal text, amber-on-blue atmospheric lighting — without referencing any branded intellectual property.
