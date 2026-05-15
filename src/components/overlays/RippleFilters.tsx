/**
 * Inline SVG `<defs>` block exposing the displacement-map filters used at the
 * tail end of the boot-to-content transition.
 *
 * @remarks
 * Renders a zero-size, absolutely-positioned `<svg>` so the filter
 * definitions sit in the document without taking layout space. Two filter
 * variants — `hud-ripple-strong` (scale 14) and `hud-ripple-soft` (scale 5)
 * — give the `hud-rgb-reveal` keyframe sequence a discrete two-frame
 * "ripple-then-settle" cap right before it lands on `filter: none`. Each
 * variant uses a different `seed` on its `<feTurbulence>` so consecutive
 * frames don't reuse the same displacement pattern (would look like a
 * single shake rather than water settling).
 *
 * Mounted once near the top of the React tree (`App.tsx`); the keyframe
 * sequence in `styles/index.css` references the filters by `id` via
 * `filter: url(#hud-ripple-strong)` / `url(#hud-ripple-soft)`.
 *
 * @example
 * ```tsx
 * // In App.tsx
 * <RippleFilters />
 * ```
 */
export function RippleFilters() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden
      focusable={false}
      style={{ position: 'absolute', pointerEvents: 'none' }}
    >
      <title>Boot-to-content transition displacement filters</title>
      <defs>
        <filter id="hud-ripple-strong" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="turbulence" baseFrequency="0.025" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="14" />
        </filter>
        <filter id="hud-ripple-soft" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="5" />
        </filter>
      </defs>
    </svg>
  );
}
