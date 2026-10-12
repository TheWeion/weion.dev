import { userLocales } from './locale';

/**
 * Whether `zone` is an IANA timezone name the runtime's `Intl` understands.
 *
 * @remarks
 * Used by `src/data/portfolio.ts` to fail the build on a bad CMS value.
 * `Intl.DateTimeFormat` throws a `RangeError` for unknown zones, which is the
 * only portable way to validate — `Intl.supportedValuesOf` omits aliases
 * such as `UTC` and `Asia/Kolkata` on some engines.
 */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Wall-clock time in `zone` at instant `at`, returned as a `Date` whose UTC
 * fields hold the zone's local fields (so `toISOString()` reads as local time).
 *
 * @remarks
 * Formats with {@link userLocales} pinned to the Gregorian calendar, Latin
 * digits, and a 24-hour cycle so the numeric parts parse identically in every
 * locale (Thai/Persian calendars, Arabic-Indic digits, …). Formatters are
 * cached because the header clock calls this once per second.
 */
function zonedWallClock(zone: string, at: Date): Date {
  const locales = userLocales();
  const key = `${zone}|${locales?.join(',') ?? ''}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locales, {
      timeZone: zone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(key, formatter);
  }
  const parts = formatter.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return new Date(
    Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')),
  );
}

/** Offset of `wall` from `at` in whole minutes, formatted as `UTC±HH:MM`. */
function offsetLabel(wall: Date, at: Date): string {
  const minutes = Math.round((wall.getTime() - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

/**
 * Current UTC offset of an IANA timezone, formatted as `UTC±HH:MM`.
 *
 * @remarks
 * Resolved through `Intl` at call time, so daylight saving is applied
 * automatically — `Europe/London` yields `UTC+00:00` in winter and
 * `UTC+01:00` in summer. Computed numerically (wall-clock time in `zone`
 * minus UTC) rather than parsed out of a `longOffset` label, because that
 * label's text varies by locale (`GMT+01:00`, `UTC+1`, …).
 *
 * @param zone - IANA timezone name (e.g. `'Europe/London'`).
 * @param at - Instant to resolve the offset for.
 * @defaultValue `at` — now
 *
 * @example
 * ```ts
 * formatUtcOffset(operative.timezone); // 'UTC+01:00'
 * ```
 */
export function formatUtcOffset(zone: string, at: Date = new Date()): string {
  return offsetLabel(zonedWallClock(zone, at), at);
}

/**
 * Timestamp of `at` as wall-clock time in `zone`, formatted
 * `YYYY-MM-DD HH:MM:SS`.
 *
 * @remarks
 * Drives the {@link TopChrome} clock. No offset suffix — the zone is already
 * shown in the hero and dossier via {@link formatUtcOffset}. Resolved per
 * call, so the clock jumps by an hour the moment daylight saving starts or ends.
 *
 * @param zone - IANA timezone name (e.g. `'Europe/London'`).
 * @param at - Instant to format.
 *
 * @example
 * ```ts
 * formatZonedTimestamp('Europe/London', now); // '2026-10-12 14:03:22'
 * ```
 */
export function formatZonedTimestamp(zone: string, at: Date): string {
  return zonedWallClock(zone, at).toISOString().replace('T', ' ').slice(0, 19);
}
