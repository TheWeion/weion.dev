import { useEffect, useState } from 'react';
import { colors } from '@/lib/tokens';
import type { TelemetryBar, TelemetryHeatmapDay } from '@/types';

/**
 * WakaTime share-chart JSON endpoints, proxied through this site's own origin.
 *
 * In production the requests are served by a Netlify Edge Function
 * (`netlify/edge-functions/wakatime.ts`) that fetches the upstream JSON and
 * rewrites its `no-store` headers so the Netlify CDN can cache the response
 * for ~24 h. In dev, Vite's `server.proxy` config forwards the same paths
 * directly to `wakatime.com`. WakaTime's own server is slow (~10-50 s TTFB);
 * the edge cache is what makes steady-state page loads instant.
 */
const SHARE = {
  waveform: '/api/wakatime/share/@Weion/6b858290-31aa-4626-9973-44e3fe47826b.json',
  languages: '/api/wakatime/share/@Weion/5af1726d-42dd-428f-b84c-4d5fe825002e.json',
  year: '/api/wakatime/share/@Weion/e7721aa6-b409-4e94-8c7f-43271fe0a81e.json',
} as const;

/** Raw shape of the 30-day daily-activity share JSON. */
interface WaveformJson {
  data: { range: { date: string }; grand_total: { total_seconds: number } }[];
}

/** Raw shape of the 30-day language-distribution share JSON. */
interface LanguagesJson {
  data: { name: string; percent: number; color: string }[];
}

/** Raw shape of the 365-day activity share JSON. */
interface YearJson {
  days: { date: string; total: number }[];
}

/**
 * One labeled stat tile (AVG/DAY, PEAK, STREAK, TOTAL, TOP LANG, BEST DAY).
 */
export interface TelemetryTile {
  /** Tile label rendered in the small uppercase eyebrow. */
  label: string;
  /** Pre-formatted display value (e.g. `'6h 42m'`, `'TypeScript'`). */
  value: string;
  /** Eyebrow accent color — typically a hex from {@link colors}. */
  color: string;
}

/** Fully-transformed telemetry payload consumed by `TelemetrySection`. */
export interface WakatimeData {
  /** Top-5 language bars + an `Other` bucket, colors mapped to the sci-fi palette. */
  bars: TelemetryBar[];
  /** 30-day stat tiles: AVG/DAY, PEAK, STREAK. */
  tiles: TelemetryTile[];
  /** 365-day heatmap cells, quartile-bucketed into levels 0-4. */
  heatmap: TelemetryHeatmapDay[];
  /** Year-summary tiles: TOTAL, TOP LANG, BEST DAY. */
  yearTiles: TelemetryTile[];
  /** 30-bar normalized waveform heights, peak = 1.0. */
  waveform: number[];
}

/** Result of {@link useWakatime}. */
export interface UseWakatimeResult {
  /** True while any of the three share-JSON fetches are in flight. */
  loading: boolean;
  /** Error message when all/any fetch failed; `null` on success or while loading. */
  error: string | null;
  /** Transformed data on success, otherwise `null`. */
  data: WakatimeData | null;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').padStart(6, '0');
  const r = Number.parseInt(clean.slice(0, 2), 16) || 0;
  const g = Number.parseInt(clean.slice(2, 4), 16) || 0;
  const b = Number.parseInt(clean.slice(4, 6), 16) || 0;
  return [r, g, b];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  // Wrap to [0, 360) before dividing — without the outer `% 360`, a hue of
  // 212° becomes hh ≈ 9.5 and falls through to the magenta branch in the
  // sector chain below, turning every blue/green/yellow input into pink.
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) {
    r = c;
    g = x;
  } else if (hh < 2) {
    r = x;
    g = c;
  } else if (hh < 3) {
    g = c;
    b = x;
  } else if (hh < 4) {
    g = x;
    b = c;
  } else if (hh < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = l - c / 2;
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * "Neon accent" saturation/lightness clamps tuned to match the existing
 * cyan / amber / magenta / alarm sci-fi tokens — those all sit in the
 * 80-100% saturation, 48-55% lightness range. Pumping a brand color into
 * this window keeps its hue (identity) while making it visually consistent
 * with the rest of the HUD: Markdown's near-panel navy lifts off the
 * background, washed-out pales come back to a punchy mid-tone, and
 * already-vibrant logos (JavaScript yellow) are nearly untouched.
 */
const SCIFI_MIN_SAT = 0.8;
const SCIFI_MIN_L = 0.5;
const SCIFI_MAX_L = 0.65;

function sciFiTune(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  const tunedS = Math.max(s, SCIFI_MIN_SAT);
  const tunedL = Math.min(SCIFI_MAX_L, Math.max(SCIFI_MIN_L, l));
  return hslToHex(h, tunedS, tunedL);
}

/**
 * Pick a bar fill color for a language.
 *
 * @remarks
 * If the upstream GitHub-Linguist hex is a recognizable brand color (HSL
 * saturation ≥ 10% — anything that isn't effectively black, white, or gray)
 * we keep its hue and pass it through {@link sciFiTune} so the bar reads
 * like the language logo (TypeScript blue, JavaScript yellow, Markdown
 * navy) but with the same neon-accent saturation / lightness as the rest of
 * the HUD palette. When the language has no real color (JSON's `#292929`,
 * plain-text grays) we fall back to a sci-fi palette token chosen by
 * lightness: dark → `bronze`, light → `halo`, true mid-gray → `muted`.
 */
function pickBarColor(hex: string): string {
  const [, s, l] = hexToHsl(hex);
  if (s >= 0.1) return sciFiTune(hex);
  if (l < 0.3) return colors.bronze;
  if (l > 0.7) return colors.halo;
  return colors.muted;
}

/**
 * Format a duration (in seconds) into a sci-fi-tile-friendly two-part string,
 * tiered so the value stays short and legible whatever the magnitude.
 *
 * @remarks
 * - `< 24 h`  → `${h}h ${mm}m` (e.g. `6h 42m`) — original behavior
 * - `< 7 d`   → `${d}d ${hh}h` (e.g. `3d 04h`)
 * - `≥ 7 d`   → `${w}w ${d}d`  (e.g. `12w 4d`)
 *
 * Used by AVG/DAY, PEAK, and TOTAL tiles. AVG/DAY and PEAK rarely tip past
 * 24 h in practice, but TOTAL (yearly) routinely runs into hundreds of hours,
 * which read terribly as `768h 12m` — the day / week tiers keep it compact.
 *
 * Negative or NaN inputs are floored to zero so a fetch glitch can't render
 * a value like `-1h NaNm`.
 */
function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.round(totalSeconds || 0));
  if (secs < 86400) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  if (secs < 7 * 86400) {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    return `${d}d ${String(h).padStart(2, '0')}h`;
  }
  const w = Math.floor(secs / (7 * 86400));
  const d = Math.floor((secs % (7 * 86400)) / 86400);
  return `${w}w ${d}d`;
}

/**
 * Format the STREAK tile value. Tiers up the same way as {@link formatDuration}
 * once a week is reached so long streaks stay readable — `42 days` becomes
 * `6w 0d`, `100 days` becomes `14w 2d`.
 */
function formatStreak(days: number): string {
  const n = Math.max(0, Math.floor(days || 0));
  if (n < 7) return `${n} day${n === 1 ? '' : 's'}`;
  const w = Math.floor(n / 7);
  const d = n % 7;
  return `${w}w ${d}d`;
}

function formatBestDay(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '—';
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  return `${month} ${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Build the language-distribution bars: top 5 by percent + an aggregated
 * `Other` bucket. WakaTime's response sometimes includes its own `Other`
 * entry; that percent is folded into our combined bucket so percentages stay
 * coherent.
 */
function buildBars(langs: LanguagesJson['data']): TelemetryBar[] {
  const named = langs.filter((l) => l.name !== 'Other' && (l.percent ?? 0) > 0);
  const top = named.slice(0, 5);
  const rest = named.slice(5);

  const bars: TelemetryBar[] = top.map((l) => ({
    label: l.name,
    pct: Math.round((l.percent ?? 0) * 10) / 10,
    color: pickBarColor(l.color || colors.muted),
  }));

  const upstreamOther = langs.find((l) => l.name === 'Other')?.percent ?? 0;
  const otherPct = rest.reduce((acc, l) => acc + (l.percent ?? 0), 0) + upstreamOther;
  if (otherPct >= 0.1) {
    bars.push({
      label: 'Other',
      pct: Math.round(otherPct * 10) / 10,
      color: colors.muted,
    });
  }

  return bars;
}

/**
 * Derive normalized waveform heights and the 30-day stat tiles from the
 * daily-activity share JSON.
 */
function buildWaveformAndTiles(data: WaveformJson['data']) {
  const days = data
    .map((d) => ({
      date: d.range?.date ?? '',
      seconds: d.grand_total?.total_seconds ?? 0,
    }))
    .filter((p) => p.date);

  let peak = 0;
  let total = 0;
  for (const p of days) {
    if (p.seconds > peak) peak = p.seconds;
    total += p.seconds;
  }
  const waveform = peak > 0 ? days.map((p) => p.seconds / peak) : days.map(() => 0);
  const avg = days.length > 0 ? total / days.length : 0;

  // Streak: walk newest -> oldest. Trailing zero days don't break the streak
  // (today might not have logged time yet); once we've seen at least one
  // coded day, the next zero gap ends it.
  let streak = 0;
  let started = false;
  for (let i = days.length - 1; i >= 0; i--) {
    const secs = days[i].seconds;
    if (secs > 0) {
      streak++;
      started = true;
    } else if (started) {
      break;
    }
  }

  const tiles: TelemetryTile[] = [
    { label: 'AVG/DAY', value: formatDuration(avg), color: colors.amber },
    { label: 'PEAK', value: formatDuration(peak), color: colors.cyan },
    { label: 'STREAK', value: formatStreak(streak), color: colors.ok },
  ];

  return { tiles, waveform };
}

/**
 * Bucket the 365 daily totals into a 0-4 heatmap and compute the year-summary
 * tiles (TOTAL hours, BEST DAY). `TOP LANG` is supplied by the caller since
 * it comes from the language share JSON, not the year-activity one.
 */
function buildHeatmapAndYearTiles(days: YearJson['days'], topLang: string) {
  const points = days.map((d) => ({ date: d.date, seconds: d.total ?? 0 }));

  // Quartiles across non-zero days only — keeps low-activity-but-daily weeks
  // distinguishable from true rest days.
  const nonZero = points
    .map((p) => p.seconds)
    .filter((s) => s > 0)
    .sort((a, b) => a - b);
  const q = (pct: number) =>
    nonZero.length ? nonZero[Math.min(nonZero.length - 1, Math.floor(nonZero.length * pct))] : 0;
  const t1 = q(0.25);
  const t2 = q(0.5);
  const t3 = q(0.75);

  const heatmap: TelemetryHeatmapDay[] = points.map(({ date, seconds }) => {
    let level: TelemetryHeatmapDay['level'] = 0;
    if (seconds <= 0) level = 0;
    else if (seconds <= t1) level = 1;
    else if (seconds <= t2) level = 2;
    else if (seconds <= t3) level = 3;
    else level = 4;
    return { date, level };
  });

  let totalSecs = 0;
  let bestDate = '';
  let bestSecs = 0;
  for (const p of points) {
    totalSecs += p.seconds;
    if (p.seconds > bestSecs) {
      bestSecs = p.seconds;
      bestDate = p.date;
    }
  }

  const yearTiles: TelemetryTile[] = [
    { label: 'TOTAL', value: formatDuration(totalSecs), color: colors.cyan },
    { label: 'TOP LANG', value: topLang || '—', color: colors.amber },
    { label: 'BEST DAY', value: formatBestDay(bestDate), color: colors.ok },
  ];

  return { heatmap, yearTiles };
}

/**
 * Fetches the three public WakaTime share-chart JSON endpoints in parallel
 * and transforms them into the shapes consumed by `TelemetrySection`.
 *
 * @remarks
 * Runs once per component mount. The fetches happen entirely client-side —
 * the previous build-time `scripts/fetch-wakatime.mjs` + `trigger-rebuild`
 * Netlify function pair has been retired in favor of WakaTime's own
 * daily-refreshed share URLs. Failures surface as `error` and leave `data`
 * `null` — the section renders empty panels in that case rather than fakes.
 *
 * @example
 * ```tsx
 * const { data, loading, error } = useWakatime();
 * const bars = data?.bars ?? [];
 * ```
 */
export function useWakatime(): UseWakatimeResult {
  const [state, setState] = useState<UseWakatimeResult>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [waveformRes, langRes, yearRes] = await Promise.all([
          fetch(SHARE.waveform),
          fetch(SHARE.languages),
          fetch(SHARE.year),
        ]);
        if (!waveformRes.ok || !langRes.ok || !yearRes.ok) {
          throw new Error(
            `WakaTime share fetch failed (${waveformRes.status}/${langRes.status}/${yearRes.status})`,
          );
        }
        const [waveformJson, langJson, yearJson] = (await Promise.all([
          waveformRes.json(),
          langRes.json(),
          yearRes.json(),
        ])) as [WaveformJson, LanguagesJson, YearJson];
        if (cancelled) return;

        const langs = langJson.data ?? [];
        const bars = buildBars(langs);
        const { tiles, waveform } = buildWaveformAndTiles(waveformJson.data ?? []);
        const topLang = langs.find((l) => l.name !== 'Other')?.name ?? '—';
        const { heatmap, yearTiles } = buildHeatmapAndYearTiles(yearJson.days ?? [], topLang);

        setState({
          loading: false,
          error: null,
          data: { bars, tiles, heatmap, yearTiles, waveform },
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          loading: false,
          error: err instanceof Error ? err.message : String(err),
          data: null,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
