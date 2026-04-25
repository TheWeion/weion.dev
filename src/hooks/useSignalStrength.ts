import { useEffect, useState } from 'react';

interface NetworkInformationLike extends EventTarget {
  downlink?: number;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  rtt?: number;
}

function getConnection(): NetworkInformationLike | undefined {
  return (navigator as unknown as { connection?: NetworkInformationLike }).connection;
}

/**
 * Maps the Network Information API's readings into a 0-100 "signal" reading.
 *
 * The UI treats this as a visual indicator, not a measurement — we combine a
 * floor derived from `effectiveType` with a downlink-based score, then apply
 * a modest RTT penalty. Values are clamped to [5, 100].
 */
function computeSignal(conn: NetworkInformationLike | undefined): number {
  if (!conn) return 97;

  const { effectiveType, downlink = 0, rtt = 0 } = conn;

  const typeFloor =
    effectiveType === '4g'
      ? 90
      : effectiveType === '3g'
        ? 65
        : effectiveType === '2g'
          ? 35
          : effectiveType === 'slow-2g'
            ? 15
            : 80;

  const downlinkScore = Math.min(100, downlink * 10);
  const rttPenalty = Math.min(25, Math.max(0, (rtt - 50) / 20));

  const raw = Math.max(typeFloor, downlinkScore) - rttPenalty;
  return Math.min(100, Math.max(5, Math.round(raw)));
}

/**
 * Returns a 0-100 signal-strength reading driven by `navigator.connection`'s
 * `change` events.
 *
 * @remarks
 * The Network Information API is Chromium-only at time of writing. On
 * browsers without it (Firefox, Safari) the hook falls back to a gentle
 * drift in the 95-99 range, refreshed every 6 seconds, so the chrome's
 * "SIG" indicator never sits perfectly still. The output is purely
 * decorative — see {@link computeSignal} for the (deliberately rough)
 * heuristic that mixes `effectiveType`, `downlink`, and `rtt`.
 *
 * @example
 * ```tsx
 * // Pad with leading spaces so "98" and "100" reserve the same column width.
 * const signalText = String(useSignalStrength()).padStart(3, ' ');
 * ```
 */
export function useSignalStrength(): number {
  const [signal, setSignal] = useState(() => computeSignal(getConnection()));

  useEffect(() => {
    const conn = getConnection();
    if (!conn) {
      const id = window.setInterval(() => {
        setSignal(95 + Math.floor(Math.random() * 5));
      }, 6000);
      return () => window.clearInterval(id);
    }
    const update = () => setSignal(computeSignal(conn));
    conn.addEventListener('change', update);
    return () => conn.removeEventListener('change', update);
  }, []);

  return signal;
}
