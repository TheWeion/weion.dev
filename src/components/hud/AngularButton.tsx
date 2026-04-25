import type { ReactNode } from 'react';
import { clipPaths, colors } from '@/lib/tokens';

/**
 * Props for {@link AngularButton}.
 */
interface AngularButtonProps {
  /**
   * Destination URL or in-page anchor (e.g. `"#archive"`). Rendered as the
   * `href` of the underlying `<a>` element.
   */
  href: string;
  /** Button label content. Typically an icon followed by uppercase text. */
  children: ReactNode;
  /**
   * Visual style.
   * - `'amber'` — strong/active CTA (filled amber wash + amber border).
   * - `'ghost'` — secondary, halo-blue outline-only treatment.
   *
   * @defaultValue `'amber'`
   */
  variant?: 'amber' | 'ghost';
  /**
   * When true, opens in a new tab and applies `rel="noopener noreferrer"`
   * to prevent reverse-tabnabbing. Set to `false` for in-page anchors or
   * same-origin navigation.
   *
   * @defaultValue `true`
   */
  external?: boolean;
}

/**
 * Cut-corner anchor button used for all primary calls-to-action.
 *
 * @remarks
 * Renders an `<a>` (not a `<button>`) — every consumer in the HUD navigates
 * somewhere, so the underlying element is always a link. The angular bevel
 * comes from the shared `clipPaths.button` token in `@/lib/tokens`, which
 * keeps the corner geometry in sync with the rest of the HUD chrome.
 *
 * Hover lifts the button by 0.5 (Tailwind `-translate-y-0.5`) for tactile
 * feedback; this respects the global focus-ring style from `index.css`.
 *
 * @example
 * ```tsx
 * <AngularButton href={socials.github}>
 *   <Github size={14} aria-hidden /> GITHUB
 * </AngularButton>
 *
 * <AngularButton href="#archive" external={false} variant="amber">
 *   <ChevronRight size={14} aria-hidden /> OPERATIONS ARCHIVE
 * </AngularButton>
 * ```
 */
export function AngularButton({
  href,
  children,
  variant = 'amber',
  external = true,
}: AngularButtonProps) {
  const isAmber = variant === 'amber';
  const linkProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <a
      href={href}
      {...linkProps}
      className="relative inline-flex items-center gap-2 px-5 py-2.5 font-body font-semibold uppercase transition-transform hover:-translate-y-0.5"
      style={{
        fontSize: 11,
        letterSpacing: '0.25em',
        clipPath: clipPaths.button,
        background: isAmber ? 'rgba(245,166,35,0.12)' : 'rgba(182,214,235,0.06)',
        border: `1px solid ${isAmber ? colors.amber : colors.halo}`,
        color: isAmber ? colors.amberHot : colors.halo,
      }}
    >
      {children}
    </a>
  );
}
