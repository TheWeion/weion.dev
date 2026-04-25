import { Activity, Radio, Shield } from 'lucide-react';
import { useClock } from '@/hooks/useClock';
import { useSignalStrength } from '@/hooks/useSignalStrength';
import { colors } from '@/lib/tokens';

/**
 * Persistent top status bar. Shows the brand mark on the left and
 * a cluster of live telemetry indicators on the right.
 *
 * @remarks
 * Fixed at `z-40` and `pointer-events-none` on the wrapper so the bar
 * never blocks scene interaction; the brand cluster re-enables pointer
 * events for itself. The right-hand telemetry block is hidden below the
 * `md` breakpoint to avoid wrapping at narrow widths.
 *
 * Live values come from {@link useClock} (UTC ISO timestamp, ticking once
 * per second) and {@link useSignalStrength} (decorative integer that drifts
 * around 90–100). The signal text is left-padded with whitespace so that
 * "98" and "100" reserve the same column width — preventing the indicator
 * from jittering each tick.
 *
 * @example
 * ```tsx
 * // In App.tsx
 * <TopChrome />
 * ```
 */
export function TopChrome() {
  const now = useClock();
  const timestamp = `${now.toISOString().replace('T', ' ').slice(0, 19)}Z`;
  // Pad with non-breaking spaces so "98" and "100" reserve the same column
  // width — nbsp keeps the preceding space from collapsing.
  const signalText = String(useSignalStrength()).padStart(3, ' ');

  return (
    <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
      <div
        className="h-[2px]"
        style={{
          background: `linear-gradient(to right, transparent, ${colors.amber}, ${colors.halo}, transparent)`,
          opacity: 0.6,
        }}
      />
      <div
        className="flex items-center justify-between px-4 md:px-6 py-2 font-body font-semibold uppercase"
        style={{ fontSize: 10, letterSpacing: '0.25em' }}
      >
        <div className="flex items-center gap-3 pointer-events-auto">
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5"
            style={{ background: colors.amber }}
          />
          <span style={{ color: colors.amber }}>WEION.DEV</span>
          <span style={{ color: colors.muted }}>//</span>
          <span style={{ color: colors.halo }}>OPERATOR TERMINAL</span>
        </div>

        <div className="hidden md:flex items-center gap-4" style={{ color: colors.muted }}>
          <span className="flex items-center gap-1.5">
            <Radio size={10} style={{ color: colors.ok }} aria-hidden />
            <span>
              SIG <span className="font-mono">{signalText}</span>%
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <Shield size={10} style={{ color: colors.ok }} aria-hidden />
            LINK SECURE
          </span>
          <span className="flex items-center gap-1.5 font-mono">
            <Activity size={10} style={{ color: colors.amber }} aria-hidden />
            {timestamp}
          </span>
        </div>
      </div>
    </header>
  );
}
