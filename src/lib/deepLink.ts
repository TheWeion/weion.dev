/**
 * Landing-URL target for an inbound deep link such as
 * `https://weion.dev/#telemetry` or `https://weion.dev/?feed=01#archive`.
 */
export interface DeepLink {
  /** Section element id to scroll to once the boot sequence has played. */
  section: string | null;
  /** Project id whose `VideoFeedModal` should open after arriving. */
  feed: string | null;
}

let captured: DeepLink = { section: null, feed: null };

/**
 * Record the landing URL's `#section` / `?feed=` target, then strip both from
 * the address bar.
 *
 * @remarks
 * Must run before React mounts (it is called from `src/main.tsx`). Left in
 * place, the fragment lets the browser jump straight to the section as soon as
 * it renders — behind the boot curtain, skipping the hero entirely. Removing
 * it here hands the scroll to {@link useDeepLink}, which plays the boot, holds
 * on the hero, then scrolls and puts `#section` back into the URL. A `feed`
 * without a fragment implies `#archive`, where the feed cards live.
 *
 * @example
 * ```ts
 * captureDeepLink();
 * window.scrollTo(0, 0);
 * createRoot(rootElement).render(<App />);
 * ```
 */
export function captureDeepLink(): void {
  const url = new URL(window.location.href);
  const hash = decodeURIComponent(url.hash.slice(1));
  const feed = url.searchParams.get('feed') || null;
  captured = { section: hash || (feed ? 'archive' : null), feed };
  if (!hash && !feed) return;
  url.searchParams.delete('feed');
  history.replaceState(history.state, '', `${url.pathname}${url.search}`);
}

/** The target recorded by {@link captureDeepLink}. */
export function getDeepLink(): DeepLink {
  return captured;
}
