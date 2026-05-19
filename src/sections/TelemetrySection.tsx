import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '@/components/hud/Panel';
import { SectionHeading } from '@/components/hud/SectionHeading';
import { useOnScreen } from '@/hooks/useOnScreen';
import { useWakatime } from '@/hooks/useWakatime';
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
 * Re-runs the timer if `bar.pct` changes (e.g. when the async WakaTime fetch
 * resolves after the section has already entered the viewport).
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
  /** When true, raise each bar from a 2% baseline to its data-driven height. */
  trigger: boolean;
  /**
   * Normalized 0-1 heights, one per day. When empty (data still loading) the
   * waveform renders as a flat baseline of zero-height bars.
   */
  heights: number[];
}

/**
 * Audio-waveform-styled visualization of daily coding activity over the last
 * 30 days.
 *
 * @remarks
 * Heights come from the WakaTime "ACTIVITY WAVEFORM" share JSON, normalized
 * so the peak day is 1.0. Until {@link useWakatime} resolves `heights` is
 * empty and the component renders a 30-bar baseline placeholder so the panel
 * height stays stable. Per-bar `transitionDelay` produces the left-to-right
 * sweep when `trigger` flips.
 */
function Waveform({ trigger, heights }: WaveformProps) {
  const bars = heights.length > 0 ? heights : new Array<number>(30).fill(0);

  return (
    <div className="flex items-end gap-1" style={{ height: 96 }}>
      {bars.map((v, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: bars are positional, index is the only stable key
          key={`bar-${i}`}
          className="flex-1 transition-all duration-500"
          style={{
            // 2% floor so zero-activity days still render a faint pip rather
            // than disappearing entirely.
            height: trigger ? `${Math.max(2, v * 100)}%` : '2%',
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
  /** 365-day activity data with quartile-bucketed levels 0-4. */
  heatmap: TelemetryHeatmapDay[];
}

/**
 * GitHub-style 7-row activity heatmap covering the trailing year.
 *
 * @remarks
 * Source data comes from {@link useWakatime}, which fetches WakaTime's public
 * year-activity share JSON at runtime; the consumer passes the resolved
 * `heatmap` array down. Layout is precomputed via {@link buildHeatmapModel}
 * inside `useMemo` and recomputed whenever the underlying data changes (so
 * the grid pops in when the async fetch resolves). Returns `null` when there
 * are no cells.
 */
function YearHeatmap({ trigger, heatmap }: YearHeatmapProps) {
  const model = useMemo(() => buildHeatmapModel(heatmap), [heatmap]);

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
 * Section 05 — developer telemetry: language distribution bars, a 30-day
 * activity waveform with stat tiles, and a year-long contribution heatmap.
 *
 * @remarks
 * All three sub-visuals share a single {@link useOnScreen} trigger so they
 * animate in together when the section enters the viewport. Underlying data
 * is fetched at runtime via {@link useWakatime} from WakaTime's public
 * share-chart JSON endpoints — no API key, no build-time generation step.
 * While the fetch is in flight the panels render empty placeholders so the
 * layout stays stable.
 */
/** Drives the panel footer text + accent color for each {@link useWakatime} state. */
type TelemetryStatus = 'loading' | 'error' | 'live';

/**
 * Footer status line shared by all three telemetry panels. Replaces the
 * previous static "LIVE FEED · UPDATED DAILY" copy so an in-flight or failed
 * WakaTime fetch surfaces something readable instead of leaving the user
 * staring at empty panels.
 */
function StatusLine({ status }: { status: TelemetryStatus }) {
  const { color, text } = (() => {
    switch (status) {
      case 'loading':
        return { color: colors.amber, text: 'FETCHING TELEMETRY ...' };
      case 'error':
        return { color: colors.alarm, text: 'LINK SEVERED · DATA UNAVAILABLE' };
      case 'live':
        return { color: colors.amber, text: 'LIVE FEED · UPDATED DAILY' };
    }
  })();

  return (
    <div
      className="mt-5 pt-4 border-t font-mono-tech flex items-center gap-2"
      style={{
        borderColor: colors.line,
        color: colors.muted,
        fontSize: 10,
        letterSpacing: '0.1em',
      }}
    >
      <span
        aria-hidden
        className={`inline-block w-1.5 h-1.5 ${status === 'loading' ? 'animate-pulse' : ''}`}
        style={{ background: color }}
      />
      <span style={{ color }}>STREAM STATUS</span>
      <span>·</span>
      <span style={{ color: status === 'error' ? colors.alarm : colors.muted }}>{text}</span>
    </div>
  );
}

export function TelemetrySection() {
  const ref = useRef<HTMLElement>(null);
  const onScreen = useOnScreen(ref);
  const { data, loading, error } = useWakatime();

  const bars = data?.bars ?? [];
  const tiles = data?.tiles ?? [];
  const heatmap = data?.heatmap ?? [];
  const yearTiles = data?.yearTiles ?? [];
  const waveform = data?.waveform ?? [];

  const status: TelemetryStatus = loading ? 'loading' : error || !data ? 'error' : 'live';

  return (
    <section ref={ref} id="telemetry" className="relative py-20 px-4 md:px-10">
      <div className="max-w-6xl mx-auto">
        <SectionHeading eyebrow="// 05 · TELEMETRY" title="DEVELOPER STATS" trigger={onScreen} />

        <div className="grid md:grid-cols-2 gap-5">
          <Panel label="30-DAY LANGUAGE DISTRIBUTION" meta="VIA WAKATIME">
            <div className="space-y-2.5">
              {bars.map((bar, i) => (
                <BarRow key={bar.label} bar={bar} delay={i * 100} trigger={onScreen} />
              ))}
            </div>
            <StatusLine status={status} />
          </Panel>

          <Panel label="ACTIVITY WAVEFORM" meta="LAST 30 DAYS" variant="amber">
            <Waveform trigger={onScreen} heights={waveform} />
            <div className="mt-4 grid grid-cols-3 gap-3">
              {tiles.map((tile) => (
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
            <StatusLine status={status} />
          </Panel>
        </div>

        <div className="mt-5">
          <Panel label="ACTIVITY · LAST YEAR" meta="VIA WAKATIME" variant="cyan">
            <YearHeatmap trigger={onScreen} heatmap={heatmap} />
            <div className="mt-5 grid grid-cols-3 gap-3">
              {yearTiles.map((tile) => (
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
            <StatusLine status={status} />
          </Panel>
        </div>
      </div>
    </section>
  );
}
