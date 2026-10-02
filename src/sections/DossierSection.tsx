import { Fragment, useRef, useState } from 'react';
import { HudModal } from '@/components/hud/HudModal';
import { Panel } from '@/components/hud/Panel';
import { SectionHeading } from '@/components/hud/SectionHeading';
import { bio, education, experience, operative, signoff } from '@/data/portfolio';
import { useOnScreen } from '@/hooks/useOnScreen';
import { clipPaths, colors } from '@/lib/tokens';
import type { Experience } from '@/types';

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
    ...(typeof operative.affiliation === 'string'
      ? [['AFFILIATION', operative.affiliation] as [string, string]]
      : []),
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

        <Panel label="SERVICE RECORD" meta={`${experience.length} ENTRIES`} className="mt-6">
          <Timeline entries={experience} />
        </Panel>

        <Panel label="EDUCATION" meta={`${education.length} ENTRIES`} className="mt-6">
          <Timeline entries={education} />
        </Panel>
      </div>
    </section>
  );
}

const fmtDate = (date: string | null) => date?.replace('-', '.') ?? 'PRESENT';

/**
 * Vertical dated list shared by the SERVICE RECORD and EDUCATION panels.
 * Each entry is a button that opens {@link RecordModal} with its details.
 */
function Timeline({ entries }: { entries: Experience[] }) {
  const [selected, setSelected] = useState<Experience | null>(null);

  return (
    <>
      <ol className="relative border-l pl-6 space-y-3" style={{ borderColor: colors.line }}>
        {entries.map((entry) => (
          <li key={`${entry.org}-${entry.role}-${entry.start}`} className="relative">
            <span
              aria-hidden
              className="absolute -left-[29px] top-3.5 size-2 rotate-45"
              style={{ background: entry.end ? colors.muted : colors.amber }}
            />
            <button
              type="button"
              onClick={() => setSelected(entry)}
              aria-haspopup="dialog"
              className="group w-full text-left px-3 py-2 -mx-3 border border-transparent transition-colors hover:border-line hover:bg-[rgba(245,166,35,0.06)] focus-visible:border-amber"
            >
              <div
                className="font-mono-tech text-xs"
                style={{ color: colors.amber, letterSpacing: '0.2em' }}
              >
                {fmtDate(entry.start)} — {fmtDate(entry.end)}
              </div>
              <div className="font-body text-base" style={{ color: colors.bright }}>
                {entry.role}
              </div>
              <div
                className="flex items-center justify-between gap-3 font-mono-tech text-xs"
                style={{ color: colors.halo }}
              >
                {entry.org}
                <span
                  className="opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  style={{ color: colors.amber, letterSpacing: '0.2em' }}
                >
                  ACCESS &gt;
                </span>
              </div>
            </button>
          </li>
        ))}
      </ol>
      {selected && <RecordModal entry={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

/** {@link HudModal} showing one timeline entry's details and skills gained. */
function RecordModal({ entry, onClose }: { entry: Experience; onClose: () => void }) {
  return (
    <HudModal
      ariaLabel={`Record for ${entry.role} at ${entry.org}`}
      eyebrow="// PERSONNEL RECORD"
      closeLabel="Close record"
      onClose={onClose}
      heading={
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono-tech" style={{ color: colors.muted, fontSize: 11 }}>
            {fmtDate(entry.start)} — {fmtDate(entry.end)}
          </span>
          <span style={{ color: colors.line }}>|</span>
          <span
            className="font-display font-bold tracking-wide"
            style={{ color: colors.bright, fontSize: '1.1rem' }}
          >
            {entry.role}
          </span>
          <span className="font-mono-tech" style={{ color: colors.muted, fontSize: 10 }}>
            · {entry.org}
          </span>
        </div>
      }
    >
      <div className="relative px-4 py-4 max-h-[60dvh] overflow-y-auto space-y-4">
        {entry.location && (
          <div
            className="font-mono-tech text-xs"
            style={{ color: colors.halo, letterSpacing: '0.15em' }}
          >
            <span style={{ color: colors.amber }}>&gt; </span>
            {entry.location}
          </div>
        )}
        {entry.summary?.map((paragraph) => (
          <p
            key={paragraph}
            className="font-body text-base leading-relaxed"
            style={{ color: colors.ink }}
          >
            {paragraph}
          </p>
        ))}
        {!entry.summary && (
          <p className="font-mono-tech text-xs" style={{ color: colors.muted }}>
            NO FURTHER DETAIL ON FILE.
          </p>
        )}
      </div>
      {entry.skills && entry.skills.length > 0 && (
        <div className="px-4 py-3 border-t" style={{ borderColor: colors.line }}>
          <div
            className="font-body font-semibold uppercase mb-2"
            style={{ color: colors.amber, fontSize: 10, letterSpacing: '0.3em' }}
          >
            // SKILLS ACQUIRED
          </div>
          <div className="flex flex-wrap gap-2">
            {entry.skills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1.5 font-body font-semibold uppercase"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.15em',
                  background: 'rgba(245,166,35,0.1)',
                  border: `1px solid ${colors.amber}`,
                  color: colors.amberHot,
                  clipPath: clipPaths.chip,
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </HudModal>
  );
}
