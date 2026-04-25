import { Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerBrackets } from '@/components/hud/CornerBrackets';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { colors } from '@/lib/tokens';
import type { Project } from '@/types';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Props for {@link VideoFeedModal}.
 */
interface VideoFeedModalProps {
  /**
   * The project whose footage should be shown. `null` closes the modal.
   * Switching from one project to another while open is supported — the
   * underlying `<video>` element is keyed on the project id so React tears down
   * and re-instantiates it cleanly between feeds.
   */
  project: Project | null;
  /** Fired by Esc, the close button, or a click on the backdrop. */
  onClose: () => void;
}

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Full-viewport sci-fi video player overlay used by `ArchiveSection` to show
 * each project's preview footage as a "RECONNAISSANCE FEED".
 *
 * @remarks
 * Layered at `z-[80]` — above the persistent chrome (`z-40`) and overlay FX
 * (`z-[60]`), but below `BootSequence` (`z-[100]`) so the boot intro can never
 * be obscured by a hanging modal.
 *
 * The video auto-plays muted (per browser autoplay policy) and loops. Custom
 * HUD-styled controls replace the native browser controls so the chrome reads
 * as part of the operator console rather than a stock player.
 *
 * Closes on Esc, click on the backdrop, or the `X` control. When the user
 * prefers reduced motion the fade-in is skipped and the REC pulse is allowed
 * to run because it conveys live recording state, not decorative motion.
 *
 * Accessibility: rendered into a `document.body` portal so the rest of the
 * app (`#root`) can be marked `inert` while open — that prevents both
 * keyboard focus and screen readers from reaching the background. Tab is
 * trapped within the dialog (cycling first/last focusables), and focus is
 * restored to whatever element triggered the open when the modal closes.
 *
 * @example
 * ```tsx
 * const [feedFor, setFeedFor] = useState<Project | null>(null);
 *
 * <button onClick={() => setFeedFor(project)}>VIEW FEED</button>
 * <VideoFeedModal project={feedFor} onClose={() => setFeedFor(null)} />
 * ```
 */
export function VideoFeedModal({ project, onClose }: VideoFeedModalProps) {
  const reducedMotion = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const open = project?.preview != null;

  // Open-time setup: scroll lock, mark the rest of the app inert, focus the
  // close button, reset video state. Cleanup undoes them in reverse so focus
  // is restored only after `inert` is gone.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    root?.setAttribute('inert', '');
    closeButtonRef.current?.focus();

    setCurrentTime(0);
    setPlaying(true);
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {
        // Autoplay can be denied even when muted; keep the UI in sync.
        setPlaying(false);
      });
    }

    return () => {
      root?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Esc closes; Tab/Shift+Tab cycle within the dialog so focus can't escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!dialog.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!project?.preview) return null;

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const seek = (event: React.MouseEvent<HTMLButtonElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    v.currentTime = ratio * duration;
    setCurrentTime(v.currentTime);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center p-4 ${
        reducedMotion ? '' : 'transition-opacity duration-300'
      } ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* Backdrop — click to close */}
      <button
        type="button"
        aria-label="Close feed"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgba(5,8,12,0.85)', backdropFilter: 'blur(8px)' }}
      />

      {/* Player frame.
          The max-width clamp picks the smaller of:
            - 896px (the original max-w-4xl cap)
            - the width that lets the 16:9 video plus header/controls/padding fit
              within 100dvh; the 200px term is the measured chrome budget.
          Whichever is smaller wins, so on short/landscape tablets the modal
          shrinks horizontally instead of overflowing the viewport. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Reconnaissance feed for ${project.name}`}
        className="relative w-full"
        style={{ maxWidth: 'min(640px, calc((100dvh - 200px) * 16 / 9))' }}
      >
        <CornerBrackets color={colors.amber} size={18} />

        <div
          className="relative"
          style={{
            background: 'linear-gradient(135deg, rgba(11,30,46,0.92) 0%, rgba(19,44,63,0.88) 100%)',
            border: `1px solid ${colors.amber}`,
            backdropFilter: 'blur(6px)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-start justify-between gap-3 px-4 py-3 border-b"
            style={{ borderColor: colors.line }}
          >
            <div className="min-w-0">
              <div
                className="font-body font-semibold uppercase mb-1"
                style={{
                  color: colors.amber,
                  fontSize: 10,
                  letterSpacing: '0.3em',
                }}
              >
                // RECONNAISSANCE FEED
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-mono-tech" style={{ color: colors.muted, fontSize: 11 }}>
                  OP-{project.id}
                </span>
                <span style={{ color: colors.line }}>|</span>
                <span
                  className="font-display font-bold tracking-wide truncate"
                  style={{ color: colors.bright, fontSize: '1.1rem' }}
                >
                  {project.name}
                </span>
                <span className="font-mono-tech" style={{ color: colors.muted, fontSize: 10 }}>
                  · {project.codename}
                </span>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close feed"
              className="shrink-0 p-1.5 transition-colors"
              style={{ border: `1px solid ${colors.line}`, color: colors.halo }}
            >
              <X size={14} aria-hidden />
            </button>
          </div>

          {/* Video frame */}
          <div className="relative" style={{ aspectRatio: '16 / 9', background: colors.void }}>
            <video
              ref={videoRef}
              key={project.id}
              muted={muted}
              loop
              playsInline
              autoPlay
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              className="absolute inset-0 w-full h-full"
            >
              <source src={project.preview.webm} type="video/webm" />
              <source src={project.preview.mp4} type="video/mp4" />
            </video>

            {/* Scanline overlay */}
            <div
              aria-hidden
              className="hud-crt-scanlines absolute inset-0 pointer-events-none"
              style={{ mixBlendMode: 'overlay', opacity: 0.6 }}
            />
            {/* CRT vertical sweep */}
            <div
              aria-hidden
              className="hud-crt-sweep absolute inset-0 pointer-events-none"
              style={{ opacity: 0.35 }}
            />

            {/* REC indicator (top-left) */}
            <div
              className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 font-body font-semibold uppercase"
              style={{
                background: 'rgba(5,8,12,0.6)',
                border: `1px solid ${colors.alarm}`,
                color: colors.alarm,
                fontSize: 9,
                letterSpacing: '0.3em',
              }}
            >
              <span
                aria-hidden
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: colors.alarm }}
              />
              REC
            </div>

            {/* Frame counter (top-right) */}
            <div
              className="absolute top-3 right-3 px-2 py-1 font-mono-tech"
              style={{
                background: 'rgba(5,8,12,0.6)',
                border: `1px solid ${colors.line}`,
                color: colors.halo,
                fontSize: 10,
                letterSpacing: '0.15em',
              }}
            >
              T+{fmtTime(currentTime)}
            </div>

            {/* Corner crosshairs (inset) */}
            <CornerBrackets color={colors.halo} size={12} />
          </div>

          {/* Controls */}
          <div className="px-4 py-3 border-t" style={{ borderColor: colors.line }}>
            {/* Scrub bar */}
            <button
              type="button"
              aria-label="Seek"
              onClick={seek}
              className="relative block w-full mb-3 cursor-pointer"
              style={{ height: 4, background: 'rgba(11,30,46,0.8)' }}
            >
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(to right, ${colors.amber}, ${colors.amberHot})`,
                  boxShadow: `0 0 8px ${colors.amber}80`,
                }}
              />
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play'}
                className="p-1.5 transition-colors"
                style={{ border: `1px solid ${colors.amber}`, color: colors.amberHot }}
              >
                {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
              </button>

              <span
                className="font-mono-tech"
                style={{
                  color: colors.halo,
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  minWidth: 90,
                }}
              >
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </span>

              <span
                className="font-body font-semibold uppercase"
                style={{
                  color: colors.ok,
                  fontSize: 9,
                  letterSpacing: '0.3em',
                  border: `1px solid ${colors.ok}`,
                  padding: '2px 6px',
                  background: 'rgba(124,232,201,0.08)',
                }}
              >
                ⟳ LOOP
              </span>

              <div className="flex-1" />

              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="p-1.5 transition-colors"
                style={{ border: `1px solid ${colors.line}`, color: colors.halo }}
              >
                {muted ? <VolumeX size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
