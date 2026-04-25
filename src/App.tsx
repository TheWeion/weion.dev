import { useState } from 'react';
import { BootSequence } from '@/components/boot/BootSequence';
import { BottomChrome } from '@/components/chrome/BottomChrome';
import { TopChrome } from '@/components/chrome/TopChrome';
import { ScreenOverlays } from '@/components/overlays/ScreenOverlays';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { HudScene } from '@/scene/HudScene';
import { ArchiveSection } from '@/sections/ArchiveSection';
import { CapabilitiesSection } from '@/sections/CapabilitiesSection';
import { DossierSection } from '@/sections/DossierSection';
import { EofSection } from '@/sections/EofSection';
import { HeroSection } from '@/sections/HeroSection';
import { TelemetrySection } from '@/sections/TelemetrySection';

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
 * - `z-[4]` / `z-[5]` — {@link ScreenOverlays}: gradient washes, scanlines,
 *   vignette, flicker, and chromatic aberration. Purely decorative CSS/SVG.
 * - `z-10` — `<main>`, the scrolling content sections (hero through EOF).
 *   Hidden at opacity 0 until {@link BootSequence} signals complete.
 * - `z-40` — {@link TopChrome} / {@link BottomChrome}, the persistent HUD
 *   frame that stays pinned across scroll.
 * - `z-[60]` — {@link BootSequence} curtain while the boot animation runs.
 * - `z-[100]` — top-most reserved layer (focus rings, transient toasts).
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

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-void text-ink">
      <BootSequence onComplete={() => setBooted(true)} skip={reducedMotion} />

      {/* Layer 0: 3D background scene */}
      <div className="fixed inset-0 z-0">
        <HudScene reducedMotion={reducedMotion} />
      </div>

      {/* Layer 5+: atmospheric gradients, scanlines, vignette, flicker */}
      <ScreenOverlays />

      <TopChrome />

      <main
        className={`relative z-10 transition-opacity duration-1000 ${
          booted ? 'opacity-100' : 'opacity-0'
        }`}
      >
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
