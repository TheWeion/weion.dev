import { useEffect, useState } from 'react';
import type { Occasion } from '@/lib/occasions';
import { useOccasion } from './useOccasion';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** Length of one occasion glitch, in ms. The visible swap lands at the midpoint. */
export const OCCASION_GLITCH_MS = 900;

/** An in-flight glitch between two occasion states (`null` = default view). */
export interface OccasionTransition {
  from: Occasion | null;
  to: Occasion | null;
  /** `performance.now()` when the glitch began, for frame-driven effects. */
  startedAt: number;
}

/**
 * {@link useOccasion}, staged so the default view shows first and then
 * glitches into the occasion — and glitches back out if the occasion ends
 * while the page is open.
 *
 * @remarks
 * Nothing changes until `active` has been true for `hold` ms, so the visitor
 * actually sees the default before it is replaced. Each change then runs a
 * {@link OCCASION_GLITCH_MS} transition: `transition` is set for its whole
 * length, and `occasion` (what to render) flips at the midpoint, under cover
 * of the glitch. A change that lands mid-glitch queues behind it.
 *
 * Under `prefers-reduced-motion` the swap still waits for `hold` but happens
 * instantly, with `transition` never set.
 *
 * @example
 * ```tsx
 * const { occasion, transition } = useOccasionTransition({ active: booted });
 * ```
 */
export function useOccasionTransition({
  active = true,
  hold = 1500,
}: {
  /** Start the hold timer only once the consumer is actually visible. @defaultValue true */
  active?: boolean;
  /** How long the default view holds before the first glitch, in ms. @defaultValue 1500 */
  hold?: number;
} = {}): { occasion: Occasion | null; transition: OccasionTransition | null } {
  const target = useOccasion();
  const reducedMotion = usePrefersReducedMotion();
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState<Occasion | null>(null);
  const [transition, setTransition] = useState<OccasionTransition | null>(null);

  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => setArmed(true), hold);
    return () => window.clearTimeout(id);
  }, [active, hold]);

  useEffect(() => {
    if (!armed || transition || target === shown) return;
    if (reducedMotion) {
      setShown(target);
      return;
    }
    setTransition({ from: shown, to: target, startedAt: performance.now() });
  }, [armed, transition, target, shown, reducedMotion]);

  // Timers keyed on the transition object alone, so the effect above
  // re-running can't cancel a glitch that's already playing.
  useEffect(() => {
    if (!transition) return;
    const swap = window.setTimeout(() => setShown(transition.to), OCCASION_GLITCH_MS / 2);
    const end = window.setTimeout(() => setTransition(null), OCCASION_GLITCH_MS);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(end);
    };
  }, [transition]);

  return { occasion: shown, transition };
}
