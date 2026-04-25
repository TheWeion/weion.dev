/**
 * Top-level operative profile rendered across the HUD chrome and the dossier.
 *
 * @remarks
 * The single instance lives in `src/data/portfolio.ts` as the `operative`
 * export. All fields render as plain text — formatting (uppercasing, slashes)
 * is intentional and stored as-authored rather than transformed at render
 * time so designers can preview the exact strings.
 */
export interface Operative {
  /** Display callsign rendered as the primary identity in the hero. */
  codename: string;
  /** Legal name shown beneath the codename in the dossier. */
  realName: string;
  /** Job title / current role (e.g. `'SENIOR SOFTWARE ENGINEER'`). */
  role: string;
  /** Current employer or organisation. */
  affiliation: string;
  /** Geographic locator string in HUD format (e.g. `'EARTH // SOL SYSTEM'`). */
  location: string;
  /** IANA-ish timezone offset rendered in the chrome (e.g. `'UTC+01:00'`). */
  timezone: string;
  /** Operational status badge text (e.g. `'ACTIVE'`, `'STANDBY'`). */
  status: string;
  /** One-line tagline / current focus shown in the hero. */
  tagline: string;
}

/**
 * A single archive entry rendered as a card in `ArchiveSection`.
 *
 * @remarks
 * Items are sourced from `src/data/projects.json`
 * Empty-string values are treated as "absent" and the
 * corresponding link/badge is omitted at render.
 */
export interface Project {
  id: string;
  name: string;
  codename: string;
  summary: string;
  stack: string[];
  /** Live deployment URL. Empty string disables the "live" link. */
  live: string;
  /** Frontend repo URL. Empty string disables the FE link. */
  fe: string;
  /** Backend repo URL. Empty string disables the BE link. */
  be: string;
  /**
   * Optional preview footage shown via the `VideoFeedModal`. Both formats are
   * served from `public/videos/projects/`; the browser picks the first
   * supported `<source>`. Omit the field entirely on projects without footage
   * — the "VIEW FEED" button is then suppressed.
   */
  preview?: {
    /** WebM source (smaller, modern-browser primary). */
    webm: string;
    /** MP4 source (universal fallback for Safari and older browsers). */
    mp4: string;
  };
}

/**
 * One bar in the language-distribution chart rendered by `TelemetrySection`.
 *
 * @remarks
 * Produced by `scripts/fetch-wakatime.mjs` from the WakaTime
 * `last_7_days` stats endpoint. The top languages plus an `Other` bucket are
 * emitted so percentages sum to ~100.
 */
export interface TelemetryBar {
  /** Language or category name (e.g. `'TypeScript'`, `'Other'`). */
  label: string;
  /** Percentage of coding time, 0–100. */
  pct: number;
  /** Bar fill color — typically a {@link ColorToken} hex from `@/lib/tokens`. */
  color: string;
}

/**
 * One day in the contribution-style activity heatmap rendered by
 * `TelemetrySection`.
 */
export interface TelemetryHeatmapDay {
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** Activity bucket: 0 = no activity, 4 = most active. */
  level: 0 | 1 | 2 | 3 | 4;
}

/**
 * Visual variant for the `Panel` HUD primitive.
 *
 * @remarks
 * - `'default'` — neutral halo-blue border on the standard panel background.
 * - `'amber'` — warm-accent border, used to flag active or featured panels.
 * - `'cyan'` — hot glitch accent, used for chromatic-aberration emphasis.
 */
export type PanelVariant = 'default' | 'amber' | 'cyan';
