/// <reference types="vite/client" />

/**
 * Salted SHA-256 of the operative's birthday (`MM-DD`), injected by
 * `vite.config.ts` from the `OPERATIVE_DOB` build env var. `null` when unset.
 */
declare const __BIRTHDAY_HASH__: string | null;
