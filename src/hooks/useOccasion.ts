import { useEffect, useState } from 'react';
import { operative } from '@/data/portfolio';
import { birthdayCandidates, birthdayDigestInput } from '@/lib/birthday';
import { OCCASIONS, type Occasion, seasonalOccasion } from '@/lib/occasions';
import { formatZonedTimestamp } from '@/lib/timezone';

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function isBirthday(hash: string, today: string): Promise<boolean> {
  if (!globalThis.crypto?.subtle) return false;
  for (const monthDay of birthdayCandidates(today)) {
    if ((await sha256Hex(birthdayDigestInput(monthDay))) === hash) return true;
  }
  return false;
}

/**
 * The calendar {@link Occasion} active today in the operative's CMS-set
 * timezone, or `null`.
 *
 * @remarks
 * The birthday wins over seasonal occasions. Its date never ships: the build
 * hashes the `OPERATIVE_DOB` env var into `__BIRTHDAY_HASH__` (see
 * `vite.config.ts`), and this hook hashes today's month-day the same way and
 * compares — so it is never active when the env var was unset at build time,
 * or outside a secure context (`crypto.subtle` is unavailable over plain-HTTP
 * LAN dev). Easter, Halloween, and Christmas come from
 * {@link seasonalOccasion}.
 *
 * Everything runs locally — no network requests. Re-checks every minute so
 * the theme switches at midnight without a reload.
 *
 * In dev, append `?occasion=<name>` (e.g. `?occasion=halloween`) to force one,
 * plus `&occasionFor=<seconds>` to have it end after that long.
 *
 * @example
 * ```tsx
 * const occasion = useOccasion(); // 'christmas' | … | null
 * ```
 */
export function useOccasion(): Occasion | null {
  const [occasion, setOccasion] = useState<Occasion | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const forced = params.get('occasion');
      if (OCCASIONS.includes(forced as Occasion)) {
        setOccasion(forced as Occasion);
        // `&occasionFor=<seconds>` ends the forced occasion, to preview the exit.
        const seconds = Number(params.get('occasionFor'));
        if (!(seconds > 0)) return;
        const id = window.setTimeout(() => setOccasion(null), seconds * 1000);
        return () => window.clearTimeout(id);
      }
    }

    let cancelled = false;
    const check = async () => {
      const today = formatZonedTimestamp(operative.timezone, new Date()).slice(0, 10);
      const hash = __BIRTHDAY_HASH__;
      const next = hash && (await isBirthday(hash, today)) ? 'birthday' : seasonalOccasion(today);
      if (!cancelled) setOccasion(next);
    };
    check().catch(() => {});
    const id = window.setInterval(() => check().catch(() => {}), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return occasion;
}
