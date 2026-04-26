import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type Plugin } from 'vite';

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
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          postprocessing: ['@react-three/postprocessing', 'postprocessing'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
