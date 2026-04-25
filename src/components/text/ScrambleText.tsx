import { useEffect, useRef, useState } from 'react';

/**
 * Props for {@link ScrambleText}.
 */
interface ScrambleTextProps {
  /** Final text to settle on once the scramble resolves. */
  text: string;
  /**
   * Set false to suppress the animation entirely (e.g. while a section is
   * still off-screen). Changing back to true restarts the effect.
   *
   * @defaultValue `true`
   */
  trigger?: boolean;
  /**
   * Total animation length in milliseconds. Internally converted to a frame
   * count assuming ~60fps, with a floor of 10 frames.
   *
   * @defaultValue `900`
   */
  duration?: number;
  /** Forwarded onto the rendered `<span>` for utility/typography classes. */
  className?: string;
}

const CHARSET = '!<>-_\\/[]{}=+*^?#01';

/**
 * Animates text in with a per-character scramble effect. Each character
 * starts as a random symbol from `CHARSET`, scrambles briefly, then settles
 * on its final character.
 *
 * @remarks
 * Heavily inspired by Justin Windle's original text-scramble demo. The
 * animation is driven by `requestAnimationFrame` rather than a fixed
 * interval, and the effect resets and re-runs on any change to `text`,
 * `trigger`, or `duration`. Each character has its own randomized
 * start/end frame so the scramble feels organic rather than synchronized.
 *
 * The pending RAF id is tracked in a ref and cancelled both on unmount and
 * before each new run, so rapid `text` changes don't stack overlapping
 * loops. Reduced-motion is not handled here — callers wanting to skip the
 * effect should pass `trigger={false}` or render the plain text directly.
 *
 * Used by {@link BootSequence} for terminal lines and by section components
 * that want letters to settle in as the user scrolls.
 *
 * @example
 * ```tsx
 * const onScreen = useOnScreen(ref);
 *
 * <ScrambleText text="OPERATIONS ARCHIVE" trigger={onScreen} duration={600} />
 * ```
 */
export function ScrambleText({
  text,
  trigger = true,
  duration = 900,
  className,
}: ScrambleTextProps) {
  const [output, setOutput] = useState(text);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!trigger) return;

    window.cancelAnimationFrame(rafRef.current);
    const length = text.length;
    const totalFrames = Math.max(10, Math.floor(duration / 16.67));

    const queue = Array.from({ length }, (_, i) => ({
      from: CHARSET[Math.floor(Math.random() * CHARSET.length)] ?? '',
      to: text[i] ?? '',
      start: Math.floor(Math.random() * totalFrames * 0.5),
      end: Math.floor(totalFrames * 0.5 + Math.random() * totalFrames * 0.5),
    }));

    let frame = 0;

    const step = () => {
      let nextOutput = '';
      let complete = 0;

      for (const entry of queue) {
        if (frame >= entry.end) {
          complete += 1;
          nextOutput += entry.to;
        } else if (frame >= entry.start) {
          nextOutput += CHARSET[Math.floor(Math.random() * CHARSET.length)] ?? '';
        } else {
          nextOutput += entry.from;
        }
      }

      setOutput(nextOutput);
      if (complete === length) return;
      frame += 1;
      rafRef.current = window.requestAnimationFrame(step);
    };

    rafRef.current = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(rafRef.current);
    };
  }, [text, trigger, duration]);

  return <span className={className}>{output}</span>;
}
