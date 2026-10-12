/**
 * Calendar occasions that re-theme the {@link HologramPortrait}.
 *
 * @remarks
 * `birthday` is resolved from a build-time hash (see `src/lib/birthday.ts`);
 * the rest are public dates computed by {@link seasonalOccasion}.
 */
export type Occasion = 'birthday' | 'easter' | 'halloween' | 'christmas';

/** Every {@link Occasion}, e.g. for validating the dev `?occasion=` override. */
export const OCCASIONS: readonly Occasion[] = ['birthday', 'easter', 'halloween', 'christmas'];

/** Fixed-date windows, inclusive, as `MM-DD`. */
const FIXED_WINDOWS: { occasion: Occasion; from: string; to: string }[] = [
  { occasion: 'halloween', from: '10-25', to: '10-31' },
  { occasion: 'christmas', from: '12-20', to: '12-26' },
];

/** Easter runs from Good Friday to Easter Monday, in days relative to Easter Sunday. */
const EASTER_WINDOW = { from: -2, to: 1 };

const DAY_MS = 86_400_000;

/**
 * Easter Sunday of `year` (Gregorian), as a UTC-midnight timestamp.
 *
 * @remarks
 * The anonymous Gregorian computus (Meeus/Jones/Butcher).
 */
function easterSunday(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}

/**
 * The public occasion (if any) that `date` falls in.
 *
 * @param date - Calendar date as `YYYY-MM-DD`, already resolved to the
 * operative's timezone.
 *
 * @example
 * ```ts
 * seasonalOccasion('2026-10-31'); // 'halloween'
 * seasonalOccasion('2026-04-06'); // 'easter' (Easter Monday)
 * ```
 */
export function seasonalOccasion(date: string): Exclude<Occasion, 'birthday'> | null {
  const monthDay = date.slice(5, 10);
  for (const { occasion, from, to } of FIXED_WINDOWS) {
    if (monthDay >= from && monthDay <= to) return occasion as Exclude<Occasion, 'birthday'>;
  }
  const year = Number(date.slice(0, 4));
  const today = Date.UTC(year, Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  const offset = Math.round((today - easterSunday(year)) / DAY_MS);
  if (offset >= EASTER_WINDOW.from && offset <= EASTER_WINDOW.to) return 'easter';
  return null;
}
