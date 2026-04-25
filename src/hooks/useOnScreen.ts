import { type RefObject, useEffect, useState } from 'react';

/**
 * Returns `true` once the observed element has entered the viewport and stays
 * `true` thereafter. Useful for one-shot reveal animations.
 *
 * @param ref - Ref to the element to observe. Stable across renders; if the
 *   underlying node changes, re-mount the consumer to re-attach the observer.
 * @param threshold - `IntersectionObserver` threshold (0-1). Fraction of the
 *   element that must be visible before the hook flips to `true`.
 * @defaultValue `threshold` — `0.2`
 *
 * @remarks
 * The observer disconnects on first intersection, so this hook is one-shot
 * by design — it cannot revert to `false` once tripped. Pass a stable `ref`
 * (e.g. from `useRef`) to avoid resubscribing every render.
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLElement>(null);
 * const onScreen = useOnScreen(ref);
 * return (
 *   <section ref={ref}>
 *     <SectionHeading title="CAPABILITIES MATRIX" trigger={onScreen} />
 *   </section>
 * );
 * ```
 */
export function useOnScreen(ref: RefObject<Element | null>, threshold = 0.2): boolean {
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOnScreen(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return onScreen;
}
