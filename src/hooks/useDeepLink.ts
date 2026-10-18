import { useEffect, useState } from 'react';
import { getDeepLink } from '@/lib/deepLink';

/**
 * How long the hero stays on screen after boot before scrolling to a
 * deep-linked section — covers the 700 ms `hud-rgb-reveal` plus a beat to
 * read the operator profile.
 */
const HERO_HOLD_MS = 1600;

/** Fallback for browsers without `scrollend`, or when no scroll was needed. */
const SCROLL_SETTLE_MS = 1500;

/**
 * Scrolls to the section captured by `captureDeepLink` once the boot
 * sequence has finished, and reports which project feed (if any) to open.
 *
 * @param booted - `App`'s boot flag; nothing happens until it is `true`.
 * @param reducedMotion - Skip the hero hold and jump without smooth scrolling.
 * @returns The deep-linked project id once the scroll has settled, otherwise
 *   `null`. Feed it to `ArchiveSection`'s `openFeedId`.
 *
 * @remarks
 * The sequence is boot → hero (for {@link HERO_HOLD_MS}) → smooth scroll →
 * `#section` restored to the URL → feed id returned, so the modal opens on
 * an already-arrived page instead of mid-scroll.
 *
 * @example
 * ```tsx
 * const deepLinkFeed = useDeepLink(booted, reducedMotion);
 * <ArchiveSection openFeedId={deepLinkFeed} />
 * ```
 */
export function useDeepLink(booted: boolean, reducedMotion: boolean): string | null {
  const [feed, setFeed] = useState<string | null>(null);

  useEffect(() => {
    if (!booted) return;
    const { section, feed: target } = getDeepLink();
    const el = section ? document.getElementById(section) : null;
    if (!section || !el) return;

    let arrived = false;
    let settleId = 0;
    const arrive = () => {
      if (arrived) return;
      arrived = true;
      window.removeEventListener('scrollend', arrive);
      window.clearTimeout(settleId);
      history.replaceState(history.state, '', `#${section}`);
      if (target) setFeed(target);
    };

    const holdId = window.setTimeout(
      () => {
        el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        if (reducedMotion) {
          arrive();
          return;
        }
        window.addEventListener('scrollend', arrive);
        settleId = window.setTimeout(arrive, SCROLL_SETTLE_MS);
      },
      reducedMotion ? 0 : HERO_HOLD_MS,
    );

    return () => {
      window.clearTimeout(holdId);
      window.clearTimeout(settleId);
      window.removeEventListener('scrollend', arrive);
    };
  }, [booted, reducedMotion]);

  return feed;
}
