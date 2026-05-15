import { lazy, Suspense, useEffect, useState } from 'react';
import { BootSequence } from '@/components/boot/BootSequence';
import { BottomChrome } from '@/components/chrome/BottomChrome';
import { TopChrome } from '@/components/chrome/TopChrome';
import { RippleFilters } from '@/components/overlays/RippleFilters';
import { ScreenOverlays } from '@/components/overlays/ScreenOverlays';
import { SceneErrorBoundary } from '@/components/SceneErrorBoundary';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ArchiveSection } from '@/sections/ArchiveSection';
import { CapabilitiesSection } from '@/sections/CapabilitiesSection';
import { DossierSection } from '@/sections/DossierSection';
import { EofSection } from '@/sections/EofSection';
import { HeroSection } from '@/sections/HeroSection';
import { TelemetrySection } from '@/sections/TelemetrySection';

// The R3F + three bundle is the largest dep on the page (~335 KiB). Splitting
// it behind React.lazy keeps the WebGL stack off the critical path so first
// paint of the HUD content doesn't wait on Three's parse/eval cost. The
// `lazy()` import isn't *triggered* until `<HudScene />` is rendered, so the
// `{booted && ...}` gate below ensures three.js doesn't begin downloading
// and parsing until the boot animation has finished — this was the original
// fix for weak-GPU laptops (e.g. Intel UHD 600) where ~1.2 MB of three/r3f
// parse blocked the boot timers and left the boot terminal stuck empty.
const HudScene = lazy(() => import('@/scene/HudScene').then((m) => ({ default: m.HudScene })));

/**
 * Top-level composition root for weion.dev. Stacks the WebGL background, the
 * decorative overlays, the persistent HUD chrome, and the scrolling content.
 *
 * @remarks
 * The page is built as a stack of fixed/absolute layers rather than normal
 * document flow. The z-index hierarchy is, from back to front:
 *
 * - `z-0` — {@link HudScene}, the R3F `<Canvas>` background (pinned via
 *   `fixed inset-0`).
 * - `z-[4]` / `z-[5]` — {@link ScreenOverlays} gradient washes (amber lens
 *   and atmospheric radial). Purely decorative CSS.
 * - `z-10` — `<main>`, the scrolling content sections (hero through EOF).
 *   Hidden at opacity 0 until {@link BootSequence} signals complete.
 * - `z-40` — {@link TopChrome} / {@link BottomChrome}, the persistent HUD
 *   frame that stays pinned across scroll.
 * - `z-[60]` — {@link ScreenOverlays} scanlines / vignette / flicker layer,
 *   above the chrome so the CRT FX cover everything.
 * - `z-[80]` — `VideoFeedModal` when open, above chrome and FX but below
 *   the boot curtain.
 * - `z-[100]` — {@link BootSequence} curtain while the boot animation runs.
 *
 * `BootSequence` gates first paint of the scrolling content; it is skipped
 * automatically when {@link usePrefersReducedMotion} returns true. The same
 * flag is forwarded to `HudScene` so the 3D layer can drop `AmbientDust` and
 * the pointer-driven camera parallax in reduced-motion mode.
 *
 * @example
 * ```tsx
 * // Mounted once from src/main.tsx — there is only ever a single instance.
 * createRoot(rootElement).render(
 *   <StrictMode>
 *     <App />
 *   </StrictMode>,
 * );
 * ```
 */
export default function App() {
  const reducedMotion = usePrefersReducedMotion();
  const [booted, setBooted] = useState(false);

  // Pre-warm the HudScene chunk so three.js is downloaded *and parsed* by the
  // time `booted` flips and the lazy mount renders for real — without this,
  // the user sees the boot end then waits ~500-1500 ms for the chunk before
  // the scene appears. The delay is timed to match the BootSequence fade
  // (2000 ms): by then every boot line is on screen and the panel is
  // visually concluded, so even on weak hardware where parsing briefly
  // blocks the main thread, the boot animation itself doesn't slip. For
  // reducedMotion users (boot is skipped) we kick off immediately.
  useEffect(() => {
    const delay = reducedMotion ? 0 : 2000;
    const id = window.setTimeout(() => {
      void import('@/scene/HudScene');
    }, delay);
    return () => window.clearTimeout(id);
  }, [reducedMotion]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-void text-ink">
      <RippleFilters />
      <BootSequence onComplete={() => setBooted(true)} skip={reducedMotion} />

      {/* Layer 0: 3D background scene. Only mounts after boot completes —
          see the comment on the `HudScene` lazy import above. Wrapped in
          SceneErrorBoundary so a WebGL failure on weak/old GPUs degrades to
          "no 3D background" instead of unmounting the rest of the app. */}
      <div className="fixed inset-0 z-0">
        {booted && (
          <SceneErrorBoundary>
            <Suspense fallback={null}>
              <HudScene reducedMotion={reducedMotion} />
            </Suspense>
          </SceneErrorBoundary>
        )}
      </div>

      {/* Layer 5+: atmospheric gradients, scanlines, vignette, flicker */}
      <ScreenOverlays />

      <TopChrome />

      <main className={`relative z-10 ${booted ? 'hud-rgb-reveal' : 'opacity-0'}`}>
        <HeroSection />
        <DossierSection />
        <CapabilitiesSection />
        <ArchiveSection />
        <TelemetrySection />
        <EofSection />
      </main>

      <BottomChrome />
    </div>
  );
}
