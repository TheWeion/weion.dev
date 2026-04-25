import type { ReactNode } from 'react';
import { clipPaths, colors } from '@/lib/tokens';
import type { PanelVariant } from '@/types';
import { CornerBrackets } from './CornerBrackets';

/**
 * Props for {@link Panel}.
 */
interface PanelProps {
  /** Panel body content rendered inside the bevelled container. */
  children: ReactNode;
  /**
   * Optional uppercase header text, shown on the left of the header row beside
   * the variant-accent square. Omitting `label` also hides the header row.
   */
  label?: string;
  /**
   * Optional secondary header text, right-aligned in muted mono. Common uses:
   * counts (`COUNT: 042`), classification (`CLASSIFICATION: OPEN`), data
   * source (`VIA WAKATIME`). Only renders when `label` is also set.
   */
  meta?: string;
  /**
   * Accent colour for the header bullet and corner brackets.
   * - `'default'` — halo-blue, neutral.
   * - `'amber'` — signal-amber, used for live/active panels.
   * - `'cyan'` — hot cyan, used for relational/network panels.
   *
   * @defaultValue `'default'`
   */
  variant?: PanelVariant;
  /**
   * Extra class names appended to the outer wrapper. Use this for layout
   * concerns (`col-span-2`, `mt-8`, etc.) — internal styling lives on the
   * inner clipped container and should not be overridden here.
   */
  className?: string;
}

const accentByVariant: Record<PanelVariant, string> = {
  default: colors.halo,
  amber: colors.amber,
  cyan: colors.cyan,
};

/**
 * Primary HUD container with bevelled corners, glassy backdrop, and optional
 * label/meta header.
 *
 * @remarks
 * The angular cut-corner geometry comes from `clipPaths.panel` in
 * {@link clipPaths}, which keeps the silhouette consistent with the rest of
 * the HUD chrome. The variant accent drives both the inline {@link CornerBrackets}
 * and the small header bullet, so a single `variant` prop visually unifies a
 * panel's role across all four corners and the header row.
 *
 * Backdrop blur and a translucent gradient sit on top of the fixed R3F scene
 * underneath the document — keep the alpha values in mind when nesting panels
 * over particularly bright parts of the scene.
 *
 * @example
 * ```tsx
 * <Panel label="LOADED MODULES" meta={`COUNT: ${String(skills.length).padStart(3, '0')}`}>
 *   <SkillGrid skills={skills} />
 * </Panel>
 *
 * <Panel label="VITALS" meta="LIVE" variant="amber">
 *   <Vitals operative={operative} />
 * </Panel>
 * ```
 */
export function Panel({ children, label, meta, variant = 'default', className = '' }: PanelProps) {
  const accent = accentByVariant[variant];

  return (
    <div className={`relative ${className}`}>
      <CornerBrackets color={accent} />

      {label && (
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span aria-hidden className="inline-block w-1.5 h-1.5" style={{ background: accent }} />
            <span
              className="font-body font-semibold uppercase"
              style={{
                color: accent,
                fontSize: 10,
                letterSpacing: '0.3em',
              }}
            >
              {label}
            </span>
          </div>
          {meta && (
            <span
              className="font-mono-tech"
              style={{
                color: colors.muted,
                fontSize: 10,
                letterSpacing: '0.2em',
              }}
            >
              {meta}
            </span>
          )}
        </div>
      )}

      <div
        className="relative p-5 md:p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(11,30,46,0.78) 0%, rgba(19,44,63,0.72) 100%)',
          border: `1px solid ${colors.line}`,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          clipPath: clipPaths.panel,
        }}
      >
        {children}
      </div>
    </div>
  );
}
