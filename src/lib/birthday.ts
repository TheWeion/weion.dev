// Imported by vite.config.ts, so no `@/` imports here — Vite loads the config
// before the alias applies.

const SALT = 'weion.dev/operative-dob';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Normalizes a date of birth to the `MM-DD` key that gets hashed.
 *
 * @remarks
 * Accepts `YYYY-MM-DD` or `MM-DD`; the year is dropped because only the
 * month and day decide whether today is the birthday. Throws on anything
 * else so a malformed `OPERATIVE_DOB` fails the build. The error message
 * deliberately omits the raw value so it doesn't land in Netlify's build log.
 *
 * @example
 * ```ts
 * parseBirthday('1990-03-14'); // '03-14'
 * ```
 */
export function parseBirthday(raw: string): string {
  const match = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(raw.trim());
  const month = Number(match?.[1]);
  const day = Number(match?.[2]);
  if (!match || month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) {
    throw new Error('OPERATIVE_DOB must be a valid date as YYYY-MM-DD or MM-DD');
  }
  return `${match[1]}-${match[2]}`;
}

/**
 * The string whose SHA-256 is compared against `__BIRTHDAY_HASH__`.
 *
 * @remarks
 * Shared by the build (Node `crypto`) and the browser (`crypto.subtle`) so
 * both sides hash exactly the same input. The salt only stops the digest
 * matching a generic lookup table — with 366 possible inputs it is
 * obfuscation, not secrecy.
 */
export function birthdayDigestInput(monthDay: string): string {
  return `${SALT}:${monthDay}`;
}

/**
 * `MM-DD` keys that count as the birthday on `date` (`YYYY-MM-DD`).
 *
 * @remarks
 * A 29 February birthday is celebrated on the 28th in non-leap years.
 */
export function birthdayCandidates(date: string): string[] {
  const year = Number(date.slice(0, 4));
  const monthDay = date.slice(5, 10);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return monthDay === '02-28' && !leap ? [monthDay, '02-29'] : [monthDay];
}
