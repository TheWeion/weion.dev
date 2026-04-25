import { skills } from '@/data/portfolio';
import { colors } from '@/lib/tokens';

/**
 * One full pass of the skills list. Two siblings of this component are
 * rendered side-by-side inside {@link BottomChrome} to form a seamless
 * `translateX(-50%)` loop — the second copy is `aria-hidden` so screen
 * readers only encounter the list once.
 */
function MarqueeCopy({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <div
      aria-hidden={ariaHidden}
      // `pr-6` adds a trailing 24px that matches the inter-item gap so the
      // seam between the two copies is indistinguishable from any other gap.
      // `shrink-0` stops flex from compressing the copies on narrow viewports.
      className="flex gap-6 whitespace-nowrap font-body font-semibold uppercase pr-6 shrink-0"
      style={{ fontSize: 11, letterSpacing: '0.2em' }}
    >
      {skills.map((skill, index) => (
        <span
          key={skill}
          className="flex items-center gap-6"
          style={{
            color: index % 5 === 0 ? colors.amber : colors.muted,
          }}
        >
          {skill}
          <span aria-hidden style={{ color: colors.line }}>
            ◆
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Persistent bottom HUD frame: an infinite horizontal marquee of the skills
 * list plus an amber/halo accent strip.
 *
 * @remarks
 * Fixed at `z-40`, matching {@link TopChrome}, and `pointer-events-none` so
 * it never blocks interaction with the underlying scene or content.
 *
 * Two identical {@link MarqueeCopy} siblings sit side-by-side with matching
 * trailing padding, so `translateX(-50%)` (driven by the `hud-marquee`
 * keyframe in `styles/index.css`) is exactly one copy wide and the loop is
 * seamless — the prior flat-duplicate-with-gap layout was short by ~half a
 * gap, which manifested as a visible jolt on mobile.
 *
 * A safe-area filler at the bottom extends the dark background through the
 * iOS home-indicator region so the footer reaches the physical window edge
 * on notched devices.
 *
 * @example
 * ```tsx
 * // In App.tsx
 * <BottomChrome />
 * ```
 */
export function BottomChrome() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div
        className="overflow-hidden py-2"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(5,8,12,0.75) 40%)',
          borderTop: `1px solid ${colors.line}`,
        }}
      >
        <div className="hud-marquee flex" style={{ width: 'max-content' }}>
          <MarqueeCopy />
          <MarqueeCopy ariaHidden />
        </div>
      </div>
      <div
        className="h-[2px]"
        style={{
          background: `linear-gradient(to right, transparent, ${colors.halo}, ${colors.amber}, transparent)`,
          opacity: 0.5,
        }}
      />
      <div
        aria-hidden
        style={{
          height: 'env(safe-area-inset-bottom, 0px)',
          background: 'rgba(5,8,12,0.75)',
        }}
      />
    </footer>
  );
}
