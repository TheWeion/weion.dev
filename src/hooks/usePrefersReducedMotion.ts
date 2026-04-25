import { useEffect, useState } from 'react';

/**
 * Tracks the user's `prefers-reduced-motion` media query. Returns `true` when
 * the user has requested reduced motion so calling components can disable
 * non-essential animations (scrambles, glitches, particle drift, etc.).
 *
 * @remarks
 * The initial value is read synchronously from `matchMedia` so the first
 * paint already reflects the user's preference — this is what allows
 * `App.tsx` to skip the `BootSequence` entirely when reduced motion is on.
 * SSR-safe: returns `false` when `window` is undefined.
 *
 * Subscribes to the `change` event so toggling the OS-level preference
 * updates the UI live.
 *
 * @example
 * ```tsx
 * const reducedMotion = usePrefersReducedMotion();
 * return reducedMotion ? <StaticHero /> : <AnimatedHero />;
 * ```
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}
