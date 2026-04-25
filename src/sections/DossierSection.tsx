import { Fragment, useRef } from 'react';
import { Panel } from '@/components/hud/Panel';
import { SectionHeading } from '@/components/hud/SectionHeading';
import { bio, operative, signoff } from '@/data/portfolio';
import { useOnScreen } from '@/hooks/useOnScreen';
import { colors } from '@/lib/tokens';

/**
 * Section 02 — personnel file with biographical record, vitals, and known
 * associates panels.
 *
 * @remarks
 * Content is sourced from `bio`, `operative`, and `signoff` exports of
 * `@/data/portfolio`. The `SectionHeading` scramble animation is gated on an
 * `IntersectionObserver` trigger via {@link useOnScreen}, so the heading only
 * plays once the section scrolls into view.
 */
export function DossierSection() {
  const ref = useRef<HTMLElement>(null);
  const onScreen = useOnScreen(ref);

  const vitals: Array<[string, string]> = [
    ['CODENAME', operative.codename],
    ['AFFILIATION', operative.affiliation],
    ['SECTOR', operative.location],
    ['TZ', operative.timezone],
    ['STATUS', operative.status],
  ];

  return (
    <section ref={ref} id="dossier" className="relative py-20 px-4 md:px-10">
      <div className="max-w-6xl mx-auto">
        <SectionHeading eyebrow="// 02 · DOSSIER" title="PERSONNEL FILE" trigger={onScreen} />

        <div className="grid md:grid-cols-[1.3fr_1fr] gap-6">
          <Panel label="BIOGRAPHICAL RECORD" meta="CLASSIFICATION: OPEN">
            <p
              className="font-body text-base md:text-lg leading-relaxed"
              style={{ color: colors.ink }}
            >
              {bio}
            </p>
            <div className="mt-6 pt-5 border-t" style={{ borderColor: colors.line }}>
              <div
                className="font-mono-tech"
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  letterSpacing: '0.05em',
                }}
              >
                <span style={{ color: colors.amber }}>&gt; </span>
                {signoff}
              </div>
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel label="VITALS" meta="LIVE" variant="amber">
              <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 font-mono-tech text-xs">
                {vitals.map(([key, value]) => (
                  <Fragment key={key}>
                    <dt style={{ color: colors.amber, letterSpacing: '0.2em' }}>{key}</dt>
                    <dd style={{ color: colors.bright }}>{value}</dd>
                  </Fragment>
                ))}
              </dl>
            </Panel>

            <Panel label="KNOWN ASSOCIATES" variant="cyan">
              <div className="font-body text-sm" style={{ color: colors.ink }}>
                Weekly TTRPG cohort ·{' '}
                <span style={{ color: colors.halo }}>Pathfinder 2e and Gumshoe</span>
              </div>
              <div className="mt-2 font-body text-sm" style={{ color: colors.ink }}>
                Reading dossier ·{' '}
                <span style={{ color: colors.halo }}>The Expanse, Halo, Warhammer 40k</span>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </section>
  );
}
