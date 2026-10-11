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

/** Non-standard per-engine audio probes; none is available everywhere. */
type AudioProbeVideo = HTMLVideoElement & {
  mozHasAudio?: boolean;
  audioTracks?: { length: number };
  webkitAudioDecodedByteCount?: number;
};

/**
 * Whether the playing source has an audio track, or `null` if it can't be
 * told yet. Firefox exposes `mozHasAudio` and Safari `audioTracks` as soon as
 * metadata loads; Chromium only reports decoded audio bytes, so a zero count
 * is trusted as "no audio" once half a second has played.
 */
function detectAudio(video: HTMLVideoElement): boolean | null {
  const v = video as AudioProbeVideo;
  if (typeof v.mozHasAudio === 'boolean') return v.mozHasAudio;
  if (v.audioTracks) return v.audioTracks.length > 0;
  if (typeof v.webkitAudioDecodedByteCount === 'number') {
    if (v.webkitAudioDecodedByteCount > 0) return true;
    return v.currentTime > 0.5 ? false : null;
  }
  return null;
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
  const [scrubbing, setScrubbing] = useState(false);
  // `null` = not known yet; the mute control stays enabled until a source is
  // positively identified as silent (see `detectAudio`).
  const [hasAudio, setHasAudio] = useState<boolean | null>(null);
  // Whether playback should resume when the current drag ends; `null` when
  // not scrubbing. A ref so the video's onPause handler can read it without
  // re-rendering mid-drag.
  const resumeAfterScrubRef = useRef<boolean | null>(null);

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

  const seek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = Number(event.currentTarget.value);
    setCurrentTime(v.currentTime);
  };

  // Pause while dragging so frames don't fight the scrub, then resume if the
  // feed was playing. The release listener lives on window so letting go
  // outside the track still ends the drag.
  const startScrub = () => {
    const v = videoRef.current;
    if (!v || resumeAfterScrubRef.current !== null) return;
    resumeAfterScrubRef.current = !v.paused;
    v.pause();
    setScrubbing(true);
    const endScrub = () => {
      window.removeEventListener('pointerup', endScrub);
      window.removeEventListener('pointercancel', endScrub);
      const resume = resumeAfterScrubRef.current;
      resumeAfterScrubRef.current = null;
      setScrubbing(false);
      if (resume) videoRef.current?.play().catch(() => setPlaying(false));
    };
    window.addEventListener('pointerup', endScrub);
    window.addEventListener('pointercancel', endScrub);
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
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            setCurrentTime(v.currentTime);
            if (hasAudio === null) setHasAudio(detectAudio(v));
          }}
          onLoadedMetadata={(e) => {
            // Fires per source (the element is keyed on project id), so this
            // also resets audio detection when switching feeds.
            setDuration(e.currentTarget.duration);
            setHasAudio(detectAudio(e.currentTarget));
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            // A scrub's temporary pause shouldn't flip the play/pause icon.
            if (resumeAfterScrubRef.current === null) setPlaying(false);
          }}
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
        {/* 16px hit area around a 4px visual track; the negative top margin
            keeps the track where the old 4px bar sat so the layout (and
            HudModal's measured ~200px chrome) is unchanged. */}
        <div className="group relative -mt-1.5 mb-1.5 h-4">
          <div
            aria-hidden
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 transition-[height] group-hover:h-1.5"
            style={{ background: 'rgba(11,30,46,0.8)' }}
          >
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(to right, ${colors.amber}, ${colors.amberHot})`,
                boxShadow: `0 0 8px ${colors.amber}80`,
              }}
            />
          </div>
          {/* Playhead diamond — shown on hover, keyboard focus, or while dragging */}
          <div
            aria-hidden
            className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 pointer-events-none transition-opacity group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 ${scrubbing ? 'opacity-100' : 'opacity-0'}`}
            style={{
              left: `${progress}%`,
              background: colors.amberHot,
              boxShadow: `0 0 8px ${colors.amber}`,
            }}
          />
          <input
            type="range"
            aria-label="Seek"
            aria-valuetext={`${fmtTime(currentTime)} of ${fmtTime(duration)}`}
            min={0}
            max={duration || 0}
            step="any"
            value={currentTime}
            disabled={!duration}
            onChange={seek}
            onPointerDown={startScrub}
            className="hud-scrubber absolute inset-0 w-full h-full"
          />
        </div>

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
            disabled={hasAudio === false}
            aria-label={hasAudio === false ? 'No audio track' : muted ? 'Unmute' : 'Mute'}
            title={hasAudio === false ? 'NO AUDIO TRACK' : undefined}
            className="p-1.5 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
            style={{ border: `1px solid ${colors.line}`, color: colors.halo }}
          >
            {muted || hasAudio === false ? (
              <VolumeX size={14} aria-hidden />
            ) : (
              <Volume2 size={14} aria-hidden />
            )}
          </button>
        </div>
      </div>
    </HudModal>
  );
}
