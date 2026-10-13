import type { ReactNode } from 'react';
import { ScrambleText } from './ScrambleText';

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
  /**
   * `ambient` jerks the ghosts every few seconds; `burst` jitters them
   * continuously (for a short transition); `off` hides them.
   *
   * @defaultValue `'ambient'`
   */
  mode?: 'ambient' | 'burst' | 'off';
  /**
   * When set, the live text re-runs a {@link ScrambleText} of this many ms
   * whenever `children` changes.
   */
  scramble?: number;
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
 * Callers should likewise leave `scramble` unset under reduced motion.
 *
 * @example
 * ```tsx
 * <h1>
 *   <GlitchText>TERRY FALLOWS</GlitchText>
 * </h1>
 *
 * // Label that scrambles and glitches only while it changes:
 * <GlitchText mode={glitching ? 'burst' : 'off'} scramble={600}>{label}</GlitchText>
 * ```
 */
export function GlitchText({
  children,
  className = '',
  mode = 'ambient',
  scramble,
}: GlitchTextProps): ReactNode {
  const modeClass = mode === 'ambient' ? '' : ` hud-glitch-text--${mode}`;
  return (
    <span className={`hud-glitch-text${modeClass} ${className}`} data-text={children}>
      <span className="relative z-10">
        {scramble ? <ScrambleText text={children} duration={scramble} /> : children}
      </span>
    </span>
  );
}
