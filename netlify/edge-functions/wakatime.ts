/**
 * Edge function that proxies WakaTime's public share-chart JSON endpoints
 * through the Netlify CDN, rewriting their cache headers.
 *
 * WakaTime's own response is dynamically generated and slow (~10-50 s TTFB),
 * and the responses are returned with `Cache-Control: no-cache, no-store`,
 * so every cold visit to weion.dev would re-pay that full latency. This
 * proxy strips the no-store directive and replaces it with:
 *
 * - `Cache-Control: public, max-age=3600` — browsers cache for 1 hour.
 * - `Netlify-CDN-Cache-Control: public, durable, s-maxage=86400` — the
 *   Netlify edge cache holds the response for 24 hours, persistently across
 *   deploys. The first visit after each 24-hour window pays the slow
 *   WakaTime cost once; everyone else loads in ~50 ms.
 *
 * Path mapping:
 *   /api/wakatime/share/@Weion/<uuid>.json
 *     -> https://wakatime.com/share/@Weion/<uuid>.json
 *
 * Only `share/*` paths are proxied; anything else returns 403 so this can't
 * be used as a generic open proxy.
 */
export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const downstream = url.pathname.replace(/^\/api\/wakatime/, '');

  if (!downstream.startsWith('/share/')) {
    return new Response('Forbidden', { status: 403 });
  }

  const upstreamUrl = `https://wakatime.com${downstream}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { headers: { Accept: 'application/json' } });
  } catch {
    return new Response('Upstream fetch failed', { status: 502 });
  }
  if (!upstream.ok) {
    return new Response(`Upstream ${upstream.status}`, { status: upstream.status });
  }

  const body = await upstream.text();

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export const config = {
  path: '/api/wakatime/*',
  cache: 'manual',
};
