import { useEffect, useState } from 'react';
import { operative } from '@/data/portfolio';
import { birthdayCandidates, birthdayDigestInput } from '@/lib/birthday';
import { formatZonedTimestamp } from '@/lib/timezone';

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Whether today is the operative's birthday, in their CMS-set timezone.
 *
 * @remarks
 * The date itself never ships: the build hashes the `OPERATIVE_DOB` env var
 * into `__BIRTHDAY_HASH__` (see `vite.config.ts`), and this hook hashes
 * today's month-day the same way and compares. Re-checks every minute so the
 * effect switches on and off at midnight without a reload. Always `false`
 * when the env var was unset at build time, or outside a secure context
 * (`crypto.subtle` is unavailable over plain-HTTP LAN dev).
 *
 * In dev, append `?birthday` to the URL to force it on.
 *
 * @example
 * ```tsx
 * const birthday = useBirthday();
 * ```
 */
export function useBirthday(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('birthday')) {
      setActive(true);
      return;
    }
    const hash = __BIRTHDAY_HASH__;
    if (!hash || !globalThis.crypto?.subtle) return;

    let cancelled = false;
    const check = async () => {
      const today = formatZonedTimestamp(operative.timezone, new Date()).slice(0, 10);
      for (const monthDay of birthdayCandidates(today)) {
        if ((await sha256Hex(birthdayDigestInput(monthDay))) === hash) {
          if (!cancelled) setActive(true);
          return;
        }
      }
      if (!cancelled) setActive(false);
    };
    check().catch(() => {});
    const id = window.setInterval(() => check().catch(() => {}), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return active;
}
