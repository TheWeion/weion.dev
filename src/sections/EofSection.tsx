import { Github, Mail } from 'lucide-react';
import { useRef } from 'react';
import { AngularButton } from '@/components/hud/AngularButton';
import { SectionHeading } from '@/components/hud/SectionHeading';
import { socials } from '@/data/portfolio';
import { useOnScreen } from '@/hooks/useOnScreen';
import { colors } from '@/lib/tokens';

/**
 * Section 06 — closing "establish link" call-to-action with GitHub and email
 * buttons plus a tongue-in-cheek `[PRINTF TO PAY RESPECTS]` sign-off.
 *
 * @remarks
 * Last section in the scrolling flow. The heading animation is gated on
 * {@link useOnScreen} so the scramble plays exactly when the visitor reaches
 * the bottom of the page.
 */
export function EofSection() {
  const ref = useRef<HTMLElement>(null);
  const onScreen = useOnScreen(ref);

  return (
    <section ref={ref} id="eof" className="relative py-24 px-4 md:px-10">
      <div className="max-w-4xl mx-auto text-center">
        <SectionHeading eyebrow="// 06 · END OF FILE" title="ESTABLISH LINK" trigger={onScreen} />

        <p
          className="font-body text-base md:text-lg leading-relaxed mb-8 max-w-2xl mx-auto"
          style={{ color: colors.ink }}
        >
          Remote terminals stand open. For collaboration, contract, or casual comms — route through
          the channels below.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <AngularButton href={socials.github} variant="amber">
            <Github size={14} aria-hidden /> GITHUB / THEWEION
          </AngularButton>
          <AngularButton href={socials.email} variant="ghost">
            <Mail size={14} aria-hidden /> SEND TRANSMISSION
          </AngularButton>
        </div>

        <div
          className="mt-16 font-mono-tech"
          style={{
            color: colors.muted,
            fontSize: 10,
            letterSpacing: '0.3em',
          }}
        >
          <span style={{ color: colors.amber }}>&gt;_</span> WEION.DEV · REACT 19 · TYPESCRIPT ·
          REACT THREE FIBER
        </div>
        <div
          className="mt-2 font-mono-tech"
          style={{
            color: colors.muted,
            fontSize: 10,
            letterSpacing: '0.3em',
          }}
        >
          END OF FILE · <span style={{ color: colors.amber }}>[PRINTF TO PAY RESPECTS]</span>
        </div>
      </div>
    </section>
  );
}
