import { useRef } from 'react';
import { Panel } from '@/components/hud/Panel';
import { SectionHeading } from '@/components/hud/SectionHeading';
import { coreSkills, skills } from '@/data/portfolio';
import { useOnScreen } from '@/hooks/useOnScreen';
import { clipPaths, colors } from '@/lib/tokens';

const coreSkillSet = new Set(coreSkills);

/**
 * Section 03 — flat grid of skill chips ("LOADED MODULES").
 *
 * @remarks
 * Skills come from `@/data/portfolio`; chips listed in `coreSkills` get the
 * amber-highlight treatment, all others render with the default halo border.
 * Membership is precomputed once into `coreSkillSet` at module load to keep
 * the per-chip lookup O(1). The heading animation is gated on
 * {@link useOnScreen}.
 */
export function CapabilitiesSection() {
  const ref = useRef<HTMLElement>(null);
  const onScreen = useOnScreen(ref);

  return (
    <section ref={ref} id="systems" className="relative py-20 px-4 md:px-10">
      <div className="max-w-6xl mx-auto">
        <SectionHeading eyebrow="// 03 · SYSTEMS" title="CAPABILITIES MATRIX" trigger={onScreen} />

        <Panel label="LOADED MODULES" meta={`COUNT: ${String(skills.length).padStart(3, '0')}`}>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => {
              const highlight = coreSkillSet.has(skill);
              return (
                <span
                  key={skill}
                  className="px-3 py-1.5 font-body font-semibold uppercase"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.15em',
                    background: highlight ? 'rgba(245,166,35,0.1)' : 'rgba(182,214,235,0.04)',
                    border: `1px solid ${highlight ? colors.amber : colors.line}`,
                    color: highlight ? colors.amberHot : colors.ink,
                    clipPath: clipPaths.chip,
                  }}
                >
                  {skill}
                </span>
              );
            })}
          </div>
        </Panel>
      </div>
    </section>
  );
}
