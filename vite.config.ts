import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type Plugin } from 'vite';
import { operative } from './src/data/portfolio';

// Fills %META_TITLE% / %META_DESCRIPTION% in index.html from `operative`, so
// <title>, description, and og:* tags share portfolio.ts as source of truth.
function operativeMeta(): Plugin {
  const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const title = attr(`${titleCase(operative.realName)} — ${titleCase(operative.role)}`);
  const description = attr(operative.tagline);
  return {
    name: 'operative-meta',
    transformIndexHtml: (html) =>
      html.replaceAll('%META_TITLE%', title).replaceAll('%META_DESCRIPTION%', description),
  };
}

// Injects <link rel="preload" as="font"> tags for the woff2 files that show
// up first paint (body copy + primary headings). With self-hosted fonts the
// @font-face declarations live inside the app CSS, so without preloads the
// browser doesn't discover the font URLs until that CSS is parsed — which
// pushes FCP/LCP back by a round-trip on throttled mobile.
function preloadCriticalFonts(): Plugin {
  const critical = ['rajdhani-latin-400', 'orbitron-latin-700'];
  return {
    name: 'preload-critical-fonts',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      const tags = Object.keys(ctx.bundle)
        .filter((name) => name.endsWith('.woff2') && critical.some((c) => name.includes(c)))
        .map(
          (name) =>
            `    <link rel="preload" href="/${name}" as="font" type="font/woff2" crossorigin />`,
        );
      if (!tags.length) return html;
      return html.replace('</head>', `${tags.join('\n')}\n  </head>`);
    },
  };
}

// Replaces the <link rel="stylesheet" href="...index-*.css"> with an inline
// <style> block containing the file contents. The app CSS is small (~6 KB
// gzipped) so inlining costs no real bytes but eliminates the only remaining
// render-blocking request — the browser can paint as soon as the HTML is
// downloaded instead of waiting for a follow-up CSS round-trip. Requires
// `style-src 'unsafe-inline'` in the production CSP (see netlify.toml).
function inlineAppStylesheet(): Plugin {
  return {
    name: 'inline-app-stylesheet',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      const cssAsset = Object.values(ctx.bundle).find(
        (asset): asset is Extract<typeof asset, { type: 'asset' }> =>
          asset.type === 'asset' && asset.fileName.endsWith('.css'),
      );
      if (!cssAsset) return html;
      const css =
        typeof cssAsset.source === 'string'
          ? cssAsset.source
          : Buffer.from(cssAsset.source).toString();
      const linkPattern = new RegExp(
        `\\s*<link[^>]+href="[^"]*${cssAsset.fileName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}"[^>]*>`,
        'g',
      );
      return html.replace(linkPattern, `\n    <style>${css}</style>`);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    operativeMeta(),
    preloadCriticalFonts(),
    inlineAppStylesheet(),
    // Emits dist/stats.html during `vite build` only — Rollup plugins are
    // inert in dev. `gzipSize`/`brotliSize` reflect what Netlify actually
    // ships; `treemap` makes the manualChunks split below easy to verify.
    visualizer({
      filename: 'dist/stats.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'r3f', test: /node_modules[\\/]@react-three[\\/](fiber|drei)[\\/]/ },
            {
              name: 'postprocessing',
              test: /node_modules[\\/](@react-three[\\/])?postprocessing[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    // The /api/wakatime proxy is fronted by a Netlify Edge Function in
    // production (see netlify/edge-functions/wakatime.ts). In dev we forward
    // the same paths directly to wakatime.com so `useWakatime` doesn't need
    // to branch on env. No caching here — dev pays the full WakaTime
    // latency every load.
    proxy: {
      '/api/wakatime': {
        target: 'https://wakatime.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/wakatime/, ''),
      },
    },
  },
});
