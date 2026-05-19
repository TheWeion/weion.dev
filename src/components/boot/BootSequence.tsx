import { useEffect, useMemo, useState } from 'react';
import { ScrambleText } from '@/components/text/ScrambleText';
import { colors } from '@/lib/tokens';

/**
 * Props for {@link BootSequence}.
 */
interface BootSequenceProps {
  /**
   * Fired once the boot animation has fully finished and the overlay is gone.
   * `App` flips its `bootComplete` state in this callback to reveal `<main>`.
   */
  onComplete: () => void;
  /**
   * When true, the animation is bypassed and `onComplete` fires synchronously
   * on mount. `App` passes the result of {@link usePrefersReducedMotion} so
   * users with `prefers-reduced-motion: reduce` skip the boot sequence
   * entirely.
   *
   * @defaultValue `false`
   */
  skip?: boolean;
}

/**
 * One line of the terminal-style boot script.
 */
interface BootLine {
  /** Delay (ms) after mount before this line is appended to the visible list. */
  delay: number;
  /** The line content. Rendered through {@link ScrambleText}. */
  text: string;
}

/**
 * Animated boot overlay. Renders a terminal-style sequence of scrambling lines
 * on top of the app while it warms up, then fades out to reveal the HUD.
 *
 * @remarks
 * Sits at `z-[100]`, above every other layer in `App.tsx` (chrome lives at
 * `z-40`, scanlines at `z-[60]`), so it visually gates first paint of the
 * scrolling sections — `App` keeps `<main>` at `opacity: 0` until
 * {@link BootSequenceProps.onComplete} fires.
 *
 * Lines are revealed on independent timers (~350ms apart). At 2000ms the
 * overlay begins its `hud-rgb-dissolve` keyframe animation and `onComplete`
 * fires *at the same instant*, so `<main>` can start its `hud-rgb-reveal`
 * in parallel — the boot tears apart while the page reassembles, no
 * sequential fade-out-then-fade-in seam. The `done` flag (which releases
 * the body scroll lock) flips in the same callback: by then the overlay is
 * `pointer-events-none`, content is mounted at its final layout positions,
 * and there's no reason to make the user wait through the reveal animation
 * before scrolling. All timers are cleared on unmount. When `skip` is true
 * the entire animation is bypassed and the callback fires immediately,
 * which is how reduced-motion users land directly on the HUD.
 *
 * @example
 * ```tsx
 * const reducedMotion = usePrefersReducedMotion();
 * const [bootComplete, setBootComplete] = useState(false);
 *
 * <BootSequence onComplete={() => setBootComplete(true)} skip={reducedMotion} />
 * ```
 */
export function BootSequence({ onComplete, skip = false }: BootSequenceProps) {
  const lines = useMemo<BootLine[]>(
    () => [
      { delay: 0, text: '> INITIATING REMOTE LINK ........' },
      { delay: 350, text: '> ESTABLISHING SECURE CHANNEL ........' },
      { delay: 700, text: '> DECRYPTING OPERATOR PROFILE ........' },
      { delay: 1050, text: '> PROFILE: FALLOWS, T. — CLEARANCE GRANTED' },
      { delay: 1400, text: '> WEION.DEV // ACCESS GRANTED. WELCOME.' },
    ],
    [],
  );

  const [visible, setVisible] = useState<BootLine[]>([]);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (skip) {
      setDone(true);
      onComplete();
      return;
    }

    const revealTimers = lines.map((line) =>
      window.setTimeout(() => setVisible((current) => [...current, line]), line.delay),
    );
    // Fire onComplete + release the scroll lock at the same instant we start
    // glitching out — <main> begins its glitch-in animation in parallel
    // (boot tears apart while the page reassembles, no sequential fade seam),
    // and the user can scroll immediately. The boot overlay is already
    // pointer-events-none from this moment on, and content is mounted in
    // its final layout positions, so there's no reason to keep scroll
    // disabled through the 700ms reveal animation.
    const fadeTimer = window.setTimeout(() => {
      setFading(true);
      setDone(true);
      onComplete();
    }, 2000);

    return () => {
      for (const id of revealTimers) window.clearTimeout(id);
      window.clearTimeout(fadeTimer);
    };
  }, [lines, onComplete, skip]);

  // Body scroll is locked from index.html so the page can't scroll behind
  // the placeholder before React mounts. Release it once the overlay is gone
  // (or immediately for reduced-motion users who skip the sequence entirely).
  useEffect(() => {
    if (skip || done) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [skip, done]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center ${
        fading ? 'hud-rgb-dissolve pointer-events-none' : ''
      }`}
      style={{ background: colors.void }}
      aria-hidden={fading}
    >
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(245,166,35,0.08) 0%, transparent 60%)',
        }}
      />
      <div className="relative max-w-2xl w-full px-6 font-mono-tech text-sm md:text-base">
        <div className="mb-6 flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block w-2 h-2 animate-pulse"
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
            REMOTE TERMINAL // SECURE SHELL
          </span>
        </div>

        {visible.map((line, i) => (
          <div
            key={line.delay}
            className="mb-2"
            style={{
              color: i === visible.length - 1 ? colors.amberHot : colors.halo,
            }}
          >
            <ScrambleText text={line.text} duration={500} />
          </div>
        ))}

        <div className="mt-4 flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-2 h-4 animate-pulse"
            style={{ background: colors.amber }}
          />
        </div>
      </div>
    </div>
  );
}
