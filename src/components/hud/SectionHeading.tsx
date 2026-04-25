import { ScrambleText } from '@/components/text/ScrambleText';
import { colors } from '@/lib/tokens';

/**
 * Props for {@link SectionHeading}.
 */
interface SectionHeadingProps {
  /**
   * Small uppercase pretitle. Convention across the site is a section index
   * plus a category, e.g. `"// 02 · DOSSIER"` or `"// 05 · TELEMETRY"`.
   */
  eyebrow: string;
  /** Large display headline rendered as an `<h2>`. */
  title: string;
  /**
   * When true, runs the scramble-in reveal on both the eyebrow and the title.
   * Consumers wire this to {@link useOnScreen} so the heading scrambles once
   * its containing section enters the viewport.
   */
  trigger: boolean;
}

/**
 * Standard section header used across every scrollable portfolio section.
 *
 * @remarks
 * Pairs a small scrambled eyebrow with a large display title, both revealing
 * via {@link ScrambleText} when `trigger` flips true. The eyebrow uses a
 * 600ms scramble while the title uses 900ms so the two lines settle in
 * staggered sequence rather than simultaneously.
 *
 * The amber-and-line underline rule below the title is decorative chrome
 * and matches the divider treatment used elsewhere in {@link Panel} headers.
 *
 * @example
 * ```tsx
 * const { ref, onScreen } = useOnScreen<HTMLElement>();
 * return (
 *   <section ref={ref}>
 *     <SectionHeading eyebrow="// 02 · DOSSIER" title="PERSONNEL FILE" trigger={onScreen} />
 *     ...
 *   </section>
 * );
 * ```
 */
export function SectionHeading({ eyebrow, title, trigger }: SectionHeadingProps) {
  return (
    <div className="mb-10">
      <div
        className="mb-3 font-body font-semibold uppercase"
        style={{
          color: colors.amber,
          fontSize: 10,
          letterSpacing: '0.35em',
        }}
      >
        <ScrambleText text={eyebrow} trigger={trigger} duration={600} />
      </div>
      <h2
        className="font-display font-black tracking-tight"
        style={{
          fontSize: 'clamp(1.8rem, 4.2vw, 3rem)',
          color: colors.bright,
        }}
      >
        <ScrambleText text={title} trigger={trigger} duration={900} />
      </h2>
      <div className="mt-4 flex items-center gap-2">
        <span className="inline-block" style={{ width: 40, height: 2, background: colors.amber }} />
        <span className="inline-block" style={{ width: 8, height: 2, background: colors.amber }} />
        <span
          className="inline-block flex-1"
          style={{
            height: 1,
            background: `linear-gradient(to right, ${colors.line}, transparent)`,
          }}
        />
      </div>
    </div>
  );
}
