/**
 * Design tokens for the HUD aesthetic.
 *
 * @remarks
 * The palette layers three visual languages:
 *  - A cool, desaturated atmospheric base (deep blues, halo-cyan).
 *  - A warm signal-amber accent for active/interactive elements.
 *  - Hot glitch accents (cyan, magenta) for chromatic aberration and status.
 *
 * These values are mirrored in `src/styles/index.css` as CSS custom properties
 * under the Tailwind v4 `@theme` block, which is what generates utilities like
 * `bg-panel`, `text-amber`, and `border-line`. The two sources MUST stay in
 * sync — when adding a new color, add it in both places using the same name
 * (kebab-case in CSS, camelCase here in TS).
 *
 * @example
 * ```tsx
 * import { colors } from '@/lib/tokens';
 *
 * <mesh>
 *   <meshBasicMaterial color={colors.halo} />
 * </mesh>
 * ```
 */
export const colors = {
  void: '#05080C',
  panel: '#0B1E2E',
  panel2: '#132C3F',
  line: '#1E3A52',
  muted: '#6A7883',
  ink: '#C0CAD3',
  bright: '#E8F1F7',
  halo: '#B6D6EB',
  amber: '#F5A623',
  amberHot: '#FFB547',
  bronze: '#8A6A3A',
  cyan: '#03D8F3',
  magenta: '#FF0055',
  ok: '#7CE8C9',
  alarm: '#E4412B',
} as const;

/**
 * Union of valid {@link colors} keys. Use to type props that accept a token
 * name (e.g. `<Panel accent="amber" />`) instead of an arbitrary CSS color.
 */
export type ColorToken = keyof typeof colors;

/**
 * Angular cut-corner clip-paths used across HUD panels and buttons.
 *
 * @remarks
 * Each entry is a CSS `polygon()` string ready to drop into a `clipPath`
 * style. The four sizes (chip < button < panel < card) keep corner geometry
 * consistent across the HUD chrome. These values are used directly from JSX
 * inline styles; there is no Tailwind utility mirror for clip-paths.
 *
 * @example
 * ```tsx
 * import { clipPaths } from '@/lib/tokens';
 *
 * <div style={{ clipPath: clipPaths.panel }} />
 * ```
 */
export const clipPaths = {
  /** Large cut corners — used on major panels and project cards. */
  panel:
    'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))',
  /** Asymmetric notch — used on primary buttons. */
  button: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
  /** Small chip corners — used on skill tags. */
  chip: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
  /** Larger panel — used on project cards. */
  card: 'polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px))',
} as const;
