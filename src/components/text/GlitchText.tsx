import type { ReactNode } from 'react';

/**
 * Props for {@link GlitchText}.
 */
interface GlitchTextProps {
  /**
   * Plain text to render. Constrained to `string` (not arbitrary
   * `ReactNode`) because the value is also written to `data-text` for the
   * pseudo-element duplicates.
   */
  children: string;
  /** Extra Tailwind / utility classes appended to the wrapper span. */
  className?: string;
}

/**
 * Wraps text in the chromatic-aberration glitch effect defined in
 * `styles/index.css`.
 *
 * @remarks
 * The effect relies on the `hud-glitch-text` rule, which reads `data-text`
 * and duplicates the content into the `::before` and `::after`
 * pseudo-elements with cyan / magenta offsets that jerk intermittently. The
 * inner span is positioned at `z-10` so the live text always sits above its
 * own glitched ghosts.
 *
 * Because the visual offset comes from CSS pseudo-elements there is no JS
 * animation loop to gate; reduced-motion users see a static, slightly
 * shifted halo rather than the jittering effect (handled in `index.css`).
 *
 * @example
 * ```tsx
 * <h1>
 *   <GlitchText>TERRY FALLOWS</GlitchText>
 * </h1>
 * ```
 */
export function GlitchText({ children, className = '' }: GlitchTextProps): ReactNode {
  return (
    <span className={`hud-glitch-text ${className}`} data-text={children}>
      <span className="relative z-10">{children}</span>
    </span>
  );
}
