import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '@/components/hud/Panel';
import { SectionHeading } from '@/components/hud/SectionHeading';
import {
  telemetryBars,
  telemetryHeatmap,
  telemetryTiles,
  telemetryYearTiles,
} from '@/data/portfolio';
import { useOnScreen } from '@/hooks/useOnScreen';
import { colors } from '@/lib/tokens';
import type { TelemetryBar, TelemetryHeatmapDay } from '@/types';

/**
 * Props for {@link BarRow}.
 */
interface BarRowProps {
  /** Language entry — label, percentage, and bar color. */
  bar: TelemetryBar;
  /** Stagger delay in ms before the bar animates from 0 to its target width. */
  delay: number;
  /** When true, kick off the fill animation; reset to `false` has no effect. */
  trigger: boolean;
}

/**
 * Single labeled progress bar in the language-distribution panel.
 *
 * @remarks
 * The fill width starts at 0 and is set to `bar.pct` via a `setTimeout` keyed
 * on `delay`, so consecutive rows wipe in with a stagger. The CSS transition
 * does the actual easing — the JS only flips the target width once per mount.
 */
function BarRow({ bar, delay, trigger }: BarRowProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    const id = window.setTimeout(() => setWidth(bar.pct), delay);
    return () => window.clearTimeout(id);
  }, [trigger, delay, bar.pct]);

  return (
    <div>
      <div
        className="flex items-center justify-between mb-1 font-body font-semibold uppercase"
        style={{ fontSize: 10, letterSpacing: '0.2em' }}
      >
        <span style={{ color: bar.color }}>{bar.label}</span>
        <span className="font-mono-tech" style={{ color: colors.muted }}>
          {String(bar.pct).padStart(2, '0')}%
        </span>
      </div>
      <div
        className="relative"
        style={{
          height: 6,
          background: 'rgba(11,30,46,0.8)',
          border: `1px solid ${colors.line}`,
        }}
      >
        <div
          className="absolute inset-y-0 left-0 transition-all duration-700 ease-out"
          style={{
            width: `${width}%`,
            background: `linear-gradient(to right, ${bar.color}, ${bar.color}40)`,
            boxShadow: `0 0 12px ${bar.color}80`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Props for {@link Waveform}.
 */
interface WaveformProps {
  /** When true, raise each bar from a 2% baseline to its seeded height. */
  trigger: boolean;
}

/**
 * 30-bar decorative audio-waveform visualization.
 *
 * @remarks
 * Heights are seeded from `Math.random()` once per mount inside `useMemo` and
 * never re-rolled — the bars are static after first paint. Because the seed
 * is unbatched (no `useId`/server seed), SSR would produce a hydration
 * mismatch; this site is client-rendered, so that is fine. Per-bar
 * `transitionDelay` produces the left-to-right sweep when `trigger` flips.
 */
function Waveform({ trigger }: WaveformProps) {
  // Deterministic-ish noise is seeded per-mount, then rendered statically.
  const bars = useMemo(() => {
    const out: { id: string; v: number }[] = [];
    for (let i = 0; i < 30; i++) out.push({ id: `bar-${i}`, v: 0.15 + Math.random() * 0.85 });
    return out;
  }, []);

  return (
    <div className="flex items-end gap-1" style={{ height: 96 }}>
      {bars.map((bar, i) => (
        <div
          key={bar.id}
          className="flex-1 transition-all duration-500"
          style={{
            height: trigger ? `${bar.v * 100}%` : '2%',
            background: `linear-gradient(to top, ${colors.amber}, ${colors.amberHot})`,
            boxShadow: `0 0 4px ${colors.amber}80`,
            transitionDelay: `${i * 30}ms`,
          }}
        />
      ))}
    </div>
  );
}

const HEATMAP_LEVEL_COLORS: Record<TelemetryHeatmapDay['level'], string> = {
  0: 'rgba(30, 58, 82, 0.55)',
  1: 'rgba(3, 216, 243, 0.18)',
  2: 'rgba(3, 216, 243, 0.42)',
  3: 'rgba(3, 216, 243, 0.70)',
  4: 'rgba(3, 216, 243, 1.00)',
};

const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

/**
 * Result of {@link buildHeatmapModel} — the precomputed grid data needed to
 * render the year heatmap.
 */
interface HeatmapGridModel {
  /** Flat cell list, column-major, with `null` entries for padding. */
  cells: (TelemetryHeatmapDay | null)[];
  /** Number of week-columns in the grid. */
  numCols: number;
  /** Sparse month labels positioned by their starting column index. */
  monthLabels: { col: number; text: string }[];
}

/**
 * Convert the flat day array into a column-major grid (7 rows × N weeks),
 * padding leading/trailing cells so every column is a full Sun-Sat week.
 * Also computes sparse month labels keyed by column index.
 *
 * @remarks
 * Month runs shorter than {@link MIN_LABEL_SPAN | 3 columns} are dropped from
 * `monthLabels` so partial months at either edge of the year don't render an
 * overlapping label at mobile widths.
 */
function buildHeatmapModel(days: TelemetryHeatmapDay[]): HeatmapGridModel {
  if (days.length === 0) {
    return { cells: [], numCols: 0, monthLabels: [] };
  }
  const first = new Date(`${days[0].date}T00:00:00Z`);
  const startPad = first.getUTCDay();
  const cells: (TelemetryHeatmapDay | null)[] = [...Array<null>(startPad).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const numCols = cells.length / 7;

  // Group columns into month runs (consecutive weeks whose Sunday is in the
  // same month), then drop short runs — partial months at the edges don't get
  // enough pixels to render a non-overlapping label at mobile widths.
  type Run = { month: number; startCol: number; span: number };
  const runs: Run[] = [];
  for (let col = 0; col < numCols; col++) {
    const cell = cells[col * 7];
    if (!cell) continue;
    const month = new Date(`${cell.date}T00:00:00Z`).getUTCMonth();
    const last = runs[runs.length - 1];
    if (last && last.month === month) {
      last.span += 1;
    } else {
      runs.push({ month, startCol: col, span: 1 });
    }
  }
  const MIN_LABEL_SPAN = 3;
  const monthLabels = runs
    .filter((r) => r.span >= MIN_LABEL_SPAN)
    .map((r) => ({ col: r.startCol, text: MONTH_NAMES[r.month] }));

  return { cells, numCols, monthLabels };
}

/**
 * Props for {@link YearHeatmap}.
 */
interface YearHeatmapProps {
  /** When true, fade the grid in (opacity 0 → 1). */
  trigger: boolean;
}

/**
 * GitHub-style 7-row activity heatmap covering the trailing year.
 *
 * @remarks
 * Source data is `telemetryHeatmap` from `@/data/portfolio`, generated
 * upstream by `scripts/fetch-wakatime.mjs`; if WakaTime is unreachable the
 * script writes placeholder data, so this component must tolerate any 0–4
 * level distribution. Layout is precomputed once via {@link buildHeatmapModel}
 * inside `useMemo`. Returns `null` when there are no cells (e.g. before the
 * generated data file exists).
 */
function YearHeatmap({ trigger }: YearHeatmapProps) {
  const model = useMemo(() => buildHeatmapModel(telemetryHeatmap), []);

  if (model.numCols === 0) return null;

  return (
    <div className="transition-opacity duration-700" style={{ opacity: trigger ? 1 : 0 }}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: model.numCols * 12 }}>
          <div
            className="relative"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${model.numCols}, minmax(0, 1fr))`,
              height: 14,
              marginBottom: 4,
            }}
          >
            {model.monthLabels.map((lbl) => (
              <span
                key={`${lbl.col}-${lbl.text}`}
                className="font-body font-semibold uppercase whitespace-nowrap"
                style={{
                  gridColumnStart: lbl.col + 1,
                  color: colors.muted,
                  fontSize: 9,
                  letterSpacing: '0.2em',
                }}
              >
                {lbl.text}
              </span>
            ))}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
              gridAutoFlow: 'column',
              gap: 2,
            }}
          >
            {model.cells.map((cell, i) => {
              if (!cell) {
                // biome-ignore lint/suspicious/noArrayIndexKey: padding cells have no semantic identity — index is the only stable key
                return <div key={`pad-${i}`} style={{ aspectRatio: '1 / 1' }} />;
              }
              const color = HEATMAP_LEVEL_COLORS[cell.level];
              return (
                <div
                  key={cell.date}
                  title={`${cell.date} · level ${cell.level}`}
                  style={{
                    aspectRatio: '1 / 1',
                    background: color,
                    border: `1px solid ${cell.level === 0 ? colors.line : 'transparent'}`,
                    boxShadow: cell.level === 4 ? `0 0 6px ${colors.cyan}80` : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div
        className="flex items-center justify-end gap-2 mt-3 font-mono-tech"
        style={{
          color: colors.muted,
          fontSize: 10,
          letterSpacing: '0.15em',
        }}
      >
        <span>LESS</span>
        <div className="flex gap-1">
          {([0, 1, 2, 3, 4] as const).map((lvl) => (
            <div
              key={lvl}
              style={{
                width: 10,
                height: 10,
                background: HEATMAP_LEVEL_COLORS[lvl],
                border: `1px solid ${lvl === 0 ? colors.line : 'transparent'}`,
              }}
            />
          ))}
        </div>
        <span>MORE</span>
      </div>
    </div>
  );
}

/**
 * Section 05 — developer telemetry: language distribution bars, a decorative
 * activity waveform with stat tiles, and a year-long contribution heatmap.
 *
 * @remarks
 * All data (`telemetryBars`, `telemetryTiles`, `telemetryHeatmap`,
 * `telemetryYearTiles`) is re-exported from `@/data/portfolio`, which in turn
 * pulls from the gitignored `src/data/wakatime.generated.ts` produced by
 * `scripts/fetch-wakatime.mjs` during `predev`/`prebuild`. Freshness is tied
 * to deploy cadence — there is no runtime fetching. All three sub-visuals
 * ({@link BarRow}, {@link Waveform}, {@link YearHeatmap}) share a single
 * {@link useOnScreen} trigger so they animate in together when the section
 * enters the viewport.
 */
export function TelemetrySection() {
  const ref = useRef<HTMLElement>(null);
  const onScreen = useOnScreen(ref);

  return (
    <section ref={ref} id="telemetry" className="relative py-20 px-4 md:px-10">
      <div className="max-w-6xl mx-auto">
        <SectionHeading eyebrow="// 05 · TELEMETRY" title="DEVELOPER STATS" trigger={onScreen} />

        <div className="grid md:grid-cols-2 gap-5">
          <Panel label="30-DAY LANGUAGE DISTRIBUTION" meta="VIA WAKATIME">
            <div className="space-y-2.5">
              {telemetryBars.map((bar, i) => (
                <BarRow key={bar.label} bar={bar} delay={i * 100} trigger={onScreen} />
              ))}
            </div>
            <div
              className="mt-5 pt-4 border-t font-mono-tech"
              style={{
                borderColor: colors.line,
                color: colors.muted,
                fontSize: 10,
                letterSpacing: '0.1em',
              }}
            >
              <span style={{ color: colors.amber }}>STREAM STATUS</span> · LIVE FEED · UPDATED DAILY
            </div>
          </Panel>

          <Panel label="ACTIVITY WAVEFORM" meta="LAST 30 DAYS" variant="amber">
            <Waveform trigger={onScreen} />
            <div className="mt-4 grid grid-cols-3 gap-3">
              {telemetryTiles.map((tile) => (
                <div key={tile.label} className="p-2 border" style={{ borderColor: colors.line }}>
                  <div
                    className="font-body font-semibold uppercase"
                    style={{
                      color: tile.color,
                      fontSize: 9,
                      letterSpacing: '0.25em',
                    }}
                  >
                    {tile.label}
                  </div>
                  <div
                    className="font-display mt-0.5"
                    style={{ color: colors.bright, fontSize: 14 }}
                  >
                    {tile.value}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-5">
          <Panel label="ACTIVITY · LAST YEAR" meta="VIA WAKATIME" variant="cyan">
            <YearHeatmap trigger={onScreen} />
            <div className="mt-5 grid grid-cols-3 gap-3">
              {telemetryYearTiles.map((tile) => (
                <div
                  key={tile.label}
                  className="p-2 border overflow-hidden"
                  style={{ borderColor: colors.line, minWidth: 0 }}
                >
                  <div
                    className="font-body font-semibold uppercase"
                    style={{
                      color: tile.color,
                      fontSize: 9,
                      letterSpacing: '0.25em',
                    }}
                  >
                    {tile.label}
                  </div>
                  <div
                    className="font-display mt-0.5"
                    style={{
                      color: colors.bright,
                      // Scales 10→14px with viewport so longer values like
                      // "JavaScript" fit in the ~70px mobile tile.
                      fontSize: 'clamp(10px, 3.2vw, 14px)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {tile.value}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}
