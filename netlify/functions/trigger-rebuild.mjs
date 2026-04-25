/**
 * Scheduled Netlify Function — fires the site's build hook once per day so the
 * WakaTime telemetry baked into `src/data/wakatime.generated.ts` at build time
 * stays fresh without a code push.
 *
 * The build hook URL is read from the `BUILD_HOOK_URL` site environment
 * variable (set in Netlify → Site configuration → Environment variables).
 * Runs at 00:00 UTC daily; adjust `schedule` below to change cadence.
 */
export default async () => {
  const hook = process.env.BUILD_HOOK_URL;
  if (!hook) {
    return new Response('BUILD_HOOK_URL env var is not set', { status: 500 });
  }

  const res = await fetch(hook, { method: 'POST' });
  if (!res.ok) {
    return new Response(`Build hook responded ${res.status}`, { status: 502 });
  }

  return new Response('Build triggered', { status: 200 });
};

export const config = {
  schedule: '@daily',
};
