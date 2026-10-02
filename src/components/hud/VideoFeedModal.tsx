import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CornerBrackets } from '@/components/hud/CornerBrackets';
import { HudModal } from '@/components/hud/HudModal';
import { colors } from '@/lib/tokens';
import type { Project } from '@/types';

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
 * The video auto-plays muted (per browser autoplay policy) and loops. Custom
 * HUD-styled controls replace the native browser controls so the chrome reads
 * as part of the operator console rather than a stock player. The REC pulse
 * runs even under reduced motion because it conveys live recording state,
 * not decorative motion.
 *
 * The dialog shell (layering, backdrop, focus trap, `inert` background,
 * scroll lock, Esc/backdrop/`X` close) comes from {@link HudModal}.
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const open = project?.preview != null;

  // Reset playback each time a feed opens.
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

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

  return (
    <HudModal
      ariaLabel={`Reconnaissance feed for ${project.name}`}
      eyebrow="// RECONNAISSANCE FEED"
      closeLabel="Close feed"
      onClose={onClose}
      // Smaller of 640px and the width that lets the 16:9 video plus
      // header/controls/padding (~200px measured chrome) fit within 100dvh,
      // so short/landscape tablets shrink horizontally instead of overflowing.
      maxWidth="min(640px, calc((100dvh - 200px) * 16 / 9))"
      heading={
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
      }
    >
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
    </HudModal>
  );
}
