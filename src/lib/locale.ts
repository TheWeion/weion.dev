/**
 * The visitor's preferred locales, most preferred first, for passing to `Intl`.
 *
 * @remarks
 * Reads `navigator.languages` (the browser's content-language preferences)
 * rather than relying on `Intl`'s implicit default, which tracks the browser
 * *UI* language and ignores the user's ordered preference list. Returns
 * `undefined` outside a browser — e.g. when `src/data/portfolio.ts` runs at
 * build time — so `Intl` falls back to the runtime default.
 *
 * @example
 * ```ts
 * new Intl.DateTimeFormat(userLocales(), { month: 'short' }).format(date);
 * ```
 */
export function userLocales(): readonly string[] | undefined {
  if (typeof navigator === 'undefined') return undefined;
  if (navigator.languages?.length) return navigator.languages;
  return navigator.language ? [navigator.language] : undefined;
}
