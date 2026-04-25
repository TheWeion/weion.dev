/**
 * Full-viewport visual overlays layered above the 3D canvas but below the
 * HUD UI.
 *
 * @remarks
 * Renders three stacked, `pointer-events-none`, `aria-hidden` layers:
 *
 * 1. `z-[4]` — amber color-graded lens that pushes 3D contrast down behind
 *    white text so the HUD copy stops blending with the scene.
 * 2. `z-[5]` — warm/cool radial gradient that deepens the atmospheric tone.
 * 3. `z-[60]` — composite layer applying the `hud-scanlines`, `hud-vignette`
 *    and `hud-flicker` utilities from `styles/index.css`. This sits *above*
 *    chrome (`z-40`) but below {@link BootSequence} (`z-[100]`).
 *
 * The CRT flicker and scanline animations are CSS-driven; they continue to
 * run in reduced-motion mode (the keyframes are mild) but the underlying
 * scene drops `AmbientDust` and pointer parallax separately.
 *
 * @example
 * ```tsx
 * // In App.tsx, between <HudScene /> and the chrome
 * <ScreenOverlays />
 * ```
 */
export function ScreenOverlays() {
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-[4]"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, rgba(255,181,71,0.14) 0%, rgba(245,166,35,0.05) 35%, transparent 70%), linear-gradient(180deg, rgba(18,11,2,0.62) 0%, rgba(32,20,5,0.42) 50%, rgba(18,11,2,0.62) 100%)',
        }}
      />
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-[5]"
        style={{
          background:
            'radial-gradient(ellipse at 60% 40%, rgba(245,166,35,0.06) 0%, transparent 55%), radial-gradient(ellipse at 30% 70%, rgba(182,214,235,0.08) 0%, transparent 60%), linear-gradient(180deg, rgba(5,8,12,0.6) 0%, rgba(5,8,12,0.2) 50%, rgba(5,8,12,0.85) 100%)',
        }}
      />
      <div
        aria-hidden
        className="hud-scanlines hud-vignette hud-flicker fixed inset-0 pointer-events-none z-[60]"
      />
    </>
  );
}
