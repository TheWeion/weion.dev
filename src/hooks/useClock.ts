import { useEffect, useState } from 'react';

/**
 * 1Hz ticking clock returning the current `Date`.
 *
 * @remarks
 * Re-renders the calling component once per second, which is acceptable for
 * the chrome-bar timestamp but should not be used in render-hot paths. The
 * interval is anchored to mount, so the first tick lands ~1s after mount
 * rather than on the next wall-clock second boundary.
 *
 * @example
 * ```tsx
 * const now = useClock();
 * const timestamp = `${now.toISOString().replace('T', ' ').slice(0, 19)}Z`;
 * ```
 */
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return now;
}
