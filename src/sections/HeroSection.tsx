import { ChevronRight, Cpu, Github, Radio, Zap } from 'lucide-react';
import { AngularButton } from '@/components/hud/AngularButton';
import { HologramPortrait } from '@/components/hud/HologramPortrait';
import { GlitchText } from '@/components/text/GlitchText';
import { operative, socials } from '@/data/portfolio';
import { colors } from '@/lib/tokens';

/**
 * One of the three stat tiles rendered beneath the hero CTA buttons.
 */
interface StatTile {
  /** Inline icon shown next to the label. */
  icon: React.ReactNode;
  /** Uppercase, letter-spaced label (e.g. `"TIMEZONE"`). */
  label: string;
  /** Display value shown beneath the label. */
  value: string;
}

const stats: StatTile[] = [
  { icon: <Cpu size={12} aria-hidden />, label: 'STATUS', value: 'ACTIVE' },
  { icon: <Radio size={12} aria-hidden />, label: 'TIMEZONE', value: operative.timezone },
  { icon: <Zap size={12} aria-hidden />, label: 'FOCUS', value: 'Android & iOS' },
];

/**
 * Landing section — operator name, role, tagline, primary CTAs, and the
 * floating {@link HologramPortrait}.
 *
 * @remarks
 * First section in the scrolling main flow and the only one without an
 * `IntersectionObserver` trigger — content is visible immediately once
 * `BootSequence` releases the page, so there is no need to gate the heading
 * animation on scroll. The portrait column is hidden below the `md` breakpoint
 * to give the headline full width on phones.
 */
export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-32 px-4 md:px-10">
      <div className="relative z-10 max-w-6xl w-full mx-auto">
        <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span
                aria-hidden
                className="inline-block w-1.5 h-1.5 animate-pulse"
                style={{ background: colors.amber }}
              />
              <span
                className="font-body font-semibold uppercase"
                style={{
                  color: colors.amber,
                  fontSize: 10,
                  letterSpacing: '0.35em',
                }}
              >
                // OPERATOR PROFILE
              </span>
            </div>

            <h1
              className="font-display font-black tracking-tight mb-2"
              style={{
                fontSize: 'clamp(2.5rem, 7vw, 5.5rem)',
                lineHeight: 0.95,
                color: colors.bright,
              }}
            >
              <GlitchText>{operative.realName}</GlitchText>
            </h1>

            <div
              className="mb-6 font-body uppercase font-semibold"
              style={{
                fontSize: 'clamp(0.9rem, 1.5vw, 1.15rem)',
                letterSpacing: '0.25em',
              }}
            >
              <span style={{ color: colors.amber }}>{operative.role}</span>
              <span style={{ color: colors.muted }}> @ </span>
              <span style={{ color: colors.halo }}>{operative.affiliation}</span>
            </div>

            <p
              className="max-w-xl mb-8 font-body text-lg leading-relaxed"
              style={{ color: colors.ink }}
            >
              {operative.tagline}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <AngularButton href="#archive" external={false} variant="amber">
                <ChevronRight size={14} aria-hidden /> OPERATIONS ARCHIVE
              </AngularButton>
              <AngularButton href={socials.github} variant="ghost">
                <Github size={14} aria-hidden /> GITHUB
              </AngularButton>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3 max-w-md">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="px-3 py-2 border font-body font-semibold uppercase"
                  style={{
                    borderColor: colors.line,
                    background: 'rgba(11,30,46,0.55)',
                    fontSize: 10,
                    letterSpacing: '0.2em',
                  }}
                >
                  <div className="flex items-center gap-1.5" style={{ color: colors.amber }}>
                    {stat.icon} {stat.label}
                  </div>
                  <div className="mt-1" style={{ color: colors.bright }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center justify-center">
            <HologramPortrait size={360} />
          </div>
        </div>
      </div>
    </section>
  );
}
