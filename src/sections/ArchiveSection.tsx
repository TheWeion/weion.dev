import { ExternalLink, Github, PlayCircle } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { CornerBrackets } from '@/components/hud/CornerBrackets';
import { SectionHeading } from '@/components/hud/SectionHeading';
import { VideoFeedModal } from '@/components/hud/VideoFeedModal';
import { projects } from '@/data/portfolio';
import { useOnScreen } from '@/hooks/useOnScreen';
import { clipPaths, colors } from '@/lib/tokens';
import type { Project } from '@/types';

/**
 * Props for {@link ProjectLink}.
 */
interface ProjectLinkProps {
  /** External URL — always opened in a new tab with `noopener noreferrer`. */
  href: string;
  /** Leading icon (typically a Lucide glyph) rendered before the label. */
  icon: ReactNode;
  /** Short label, usually a 2–4 letter uppercase tag (`LIVE`, `FE`, `BE`). */
  children: ReactNode;
}

/**
 * Compact bronze-bordered link button used inside {@link ProjectCard} for the
 * live / frontend / backend repo links.
 */
function ProjectLink({ href, icon, children }: ProjectLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 font-body font-semibold uppercase hover:-translate-y-0.5 transition-transform"
      style={{
        fontSize: 10,
        letterSpacing: '0.25em',
        background: 'rgba(245,166,35,0.08)',
        border: `1px solid ${colors.bronze}`,
        color: colors.amberHot,
      }}
    >
      {icon} {children}
    </a>
  );
}

/**
 * Props for {@link ProjectCard}.
 */
interface ProjectCardProps {
  /** A single project entry from `@/data/portfolio`. */
  project: Project;
  /**
   * Fired when the VIEW FEED button is clicked. The card itself doesn't own
   * the modal — `ArchiveSection` lifts that state so only one modal exists.
   */
  onOpenFeed: () => void;
}

/**
 * One angular operations-log card: codename, name, summary, stack chips, and
 * the live/FE/BE link row.
 *
 * @remarks
 * Tracks a local `hover` state that is driven by both `mouseenter`/`mouseleave`
 * and `focus`/`blur` so keyboard users see the same amber accent treatment as
 * pointer users. The corner brackets and panel border share that same hover
 * color. The "VIEW FEED" button is only rendered when `project.preview` is
 * defined; the modal it triggers lives at the section level.
 */
function ProjectCard({ project, onOpenFeed }: ProjectCardProps) {
  const [hover, setHover] = useState(false);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: presentational hover/focus wrapper for visual styling only — interactive children carry their own semantics
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <CornerBrackets color={hover ? colors.amber : colors.halo} />
      <div
        className="relative p-5 transition-all duration-300"
        style={{
          background: hover
            ? 'linear-gradient(135deg, rgba(19,44,63,0.88) 0%, rgba(30,58,82,0.78) 100%)'
            : 'linear-gradient(135deg, rgba(11,30,46,0.82) 0%, rgba(19,44,63,0.72) 100%)',
          border: `1px solid ${hover ? colors.amber : colors.line}`,
          clipPath: clipPaths.card,
        }}
      >
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono-tech" style={{ color: colors.amber, fontSize: 11 }}>
                OP-{project.id}
              </span>
              <span style={{ color: colors.line }}>|</span>
              <span className="font-mono-tech" style={{ color: colors.muted, fontSize: 11 }}>
                {project.codename}
              </span>
            </div>
            <h3
              className="font-display font-bold tracking-wide"
              style={{ fontSize: '1.4rem', color: colors.bright }}
            >
              {project.name}
            </h3>
          </div>
          <div
            className="flex items-center gap-1.5 px-2 py-1 font-body font-semibold uppercase shrink-0"
            style={{
              border: `1px solid ${colors.ok}`,
              color: colors.ok,
              background: 'rgba(124,232,201,0.08)',
              fontSize: 9,
              letterSpacing: '0.25em',
            }}
          >
            <span
              aria-hidden
              className="w-1 h-1 rounded-full animate-pulse"
              style={{ background: colors.ok }}
            />
            OPERATIONAL
          </div>
        </div>

        <p className="font-body text-sm leading-relaxed mb-4" style={{ color: colors.ink }}>
          {project.summary}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {project.stack.map((tech) => (
            <span
              key={tech}
              className="px-2 py-0.5 font-body font-semibold uppercase"
              style={{
                fontSize: 10,
                letterSpacing: '0.2em',
                background: 'rgba(3,216,243,0.08)',
                border: `1px solid ${colors.cyan}`,
                color: colors.cyan,
              }}
            >
              {tech}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-4 border-t" style={{ borderColor: colors.line }}>
          {project.preview && (
            <button
              type="button"
              onClick={onOpenFeed}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 font-body font-semibold uppercase hover:-translate-y-0.5 transition-transform"
              style={{
                fontSize: 10,
                letterSpacing: '0.25em',
                background: 'rgba(245,166,35,0.18)',
                border: `1px solid ${colors.amber}`,
                color: colors.amberHot,
              }}
            >
              <PlayCircle size={11} aria-hidden /> VIEW FEED
            </button>
          )}
          <ProjectLink href={project.live} icon={<ExternalLink size={11} aria-hidden />}>
            LIVE
          </ProjectLink>
          <ProjectLink href={project.fe} icon={<Github size={11} aria-hidden />}>
            FE
          </ProjectLink>
          <ProjectLink href={project.be} icon={<Github size={11} aria-hidden />}>
            BE
          </ProjectLink>
        </div>
      </div>
    </div>
  );
}

/**
 * Section 04 — two-column grid of {@link ProjectCard}s sourced from
 * `projects` in `@/data/portfolio`.
 *
 * @remarks
 * The heading scramble animation is gated on {@link useOnScreen}; cards
 * themselves are static and rendered immediately. A single
 * {@link VideoFeedModal} is mounted at section level so only one feed can be
 * open at a time — switching projects swaps the active source via the
 * `feedFor` state.
 */
export function ArchiveSection() {
  const ref = useRef<HTMLElement>(null);
  const onScreen = useOnScreen(ref);
  const [feedFor, setFeedFor] = useState<Project | null>(null);

  return (
    <section ref={ref} id="archive" className="relative py-20 px-4 md:px-10">
      <div className="max-w-6xl mx-auto">
        <SectionHeading eyebrow="// 04 · ARCHIVE" title="OPERATIONS LOG" trigger={onScreen} />
        <div className="grid md:grid-cols-2 gap-5">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpenFeed={() => setFeedFor(project)}
            />
          ))}
        </div>
      </div>
      <VideoFeedModal project={feedFor} onClose={() => setFeedFor(null)} />
    </section>
  );
}
