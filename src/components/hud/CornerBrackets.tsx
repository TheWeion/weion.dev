import type { CSSProperties } from 'react';
import { colors } from '@/lib/tokens';

/**
 * Props for {@link CornerBrackets}.
 */
interface CornerBracketsProps {
  /**
   * Stroke colour for the four L-shaped brackets. Typically a token from
   * {@link colors} so the accent matches the surrounding panel variant.
   *
   * @defaultValue `colors.halo`
   */
  color?: string;
  /**
   * Edge length in pixels for each L-bracket (width === height).
   *
   * @defaultValue 14
   */
  size?: number;
}

/**
 * Four L-shaped bracket marks pinned to the corners of a positioned parent.
 *
 * @remarks
 * The parent must be `position: relative` (or otherwise establish a containing
 * block) for the absolutely-positioned bracket spans to anchor correctly.
 * Each bracket is offset by `-1px` so the 1.5px stroke sits flush over the
 * parent's 1px border rather than inside it. Spans are `aria-hidden` and
 * `pointer-events: none` — purely decorative chrome.
 *
 * Used standalone inside {@link Panel} and {@link HologramPortrait}, and
 * directly in section components for hover-accented project cards.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <CornerBrackets color={hover ? colors.amber : colors.halo} />
 *   {children}
 * </div>
 * ```
 */
export function CornerBrackets({ color = colors.halo, size = 14 }: CornerBracketsProps) {
  const dimension = `${size}px`;
  const base: CSSProperties = {
    position: 'absolute',
    width: dimension,
    height: dimension,
    pointerEvents: 'none',
  };

  return (
    <>
      <span
        aria-hidden
        style={{
          ...base,
          top: -1,
          left: -1,
          borderTop: `1.5px solid ${color}`,
          borderLeft: `1.5px solid ${color}`,
        }}
      />
      <span
        aria-hidden
        style={{
          ...base,
          top: -1,
          right: -1,
          borderTop: `1.5px solid ${color}`,
          borderRight: `1.5px solid ${color}`,
        }}
      />
      <span
        aria-hidden
        style={{
          ...base,
          bottom: -1,
          left: -1,
          borderBottom: `1.5px solid ${color}`,
          borderLeft: `1.5px solid ${color}`,
        }}
      />
      <span
        aria-hidden
        style={{
          ...base,
          bottom: -1,
          right: -1,
          borderBottom: `1.5px solid ${color}`,
          borderRight: `1.5px solid ${color}`,
        }}
      />
    </>
  );
}
