import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

/**
 * Logs Core Web Vitals to the console as the browser reports them.
 *
 * @remarks
 * Wires up the five metrics that matter for a content-heavy single page:
 * CLS (layout stability), INP (interaction latency), LCP (largest paint),
 * FCP (first paint), TTFB (network). Each fires at most once per page
 * lifecycle except INP, which updates whenever a worse interaction is
 * observed. The callback is intentionally console-only — there is no
 * analytics endpoint to ship to, but values can still be inspected during
 * a Lighthouse run or while debugging on a real device.
 *
 * Called once from {@link "main"} immediately after `createRoot(...).render`.
 *
 * @example
 * ```ts
 * // src/main.tsx
 * createRoot(rootElement).render(<App />);
 * reportVitals();
 * ```
 */
export function reportVitals(): void {
  const log = (metric: Metric) => {
    console.log(`[vitals] ${metric.name} = ${metric.value.toFixed(2)} (${metric.rating})`);
  };

  onCLS(log);
  onINP(log);
  onLCP(log);
  onFCP(log);
  onTTFB(log);
}
