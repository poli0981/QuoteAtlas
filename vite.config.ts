import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import pkg from './package.json';

// Set by the Tauri CLI when it invokes `npm run dev`/`build` (docs/02 §3). Absent
// for a plain web/Cloudflare build, so the PWA path below stays the web default.
const tauriPlatform = process.env.TAURI_ENV_PLATFORM;
const tauriDevHost = process.env.TAURI_DEV_HOST;
const tauriDebug = !!process.env.TAURI_ENV_DEBUG;

// Offline-first PWA (docs/08 §5): precache the app shell + bundled data + fonts;
// `prompt` surfaces a reload toast on SW update rather than auto-reloading.
export default defineConfig({
  // Tauri: keep the Rust compiler output visible and expose TAURI_ENV_* to the app.
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Native (Tauri) build: skip SW + manifest emission so the webview never
      // registers a service worker (which would serve a stale bundle after an app
      // update). `disable` still leaves `virtual:pwa-register/react` resolvable as a
      // no-op, so app/UpdateToast.tsx's unconditional import keeps compiling.
      disable: !!tauriPlatform,
      registerType: 'prompt',
      // The app registers the SW itself (useRegisterSW in app/UpdateToast.tsx), so
      // the plugin must NOT inject its own registration <script> into index.html:
      // an inline script would need `script-src 'unsafe-inline'`, which docs/09 §1
      // makes a blocking review item. Keeping this null keeps the CSP strict.
      injectRegister: null,
      includeAssets: ['icon.svg', '404.html', '404.css'],
      manifest: {
        id: '/',
        name: 'QuoteAtlas',
        short_name: 'QuoteAtlas',
        description: 'Ambient quote display — offline-first.',
        lang: 'en',
        dir: 'ltr',
        theme_color: '#0f172a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'any',
        categories: ['lifestyle', 'productivity'],
        scope: '/',
        start_url: '/',
        // TODO(human asset): real 192/512 PNGs — Android's install prompt wants a
        // raster maskable icon; icon.svg is the placeholder (docs/00 §8).
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        // The quote pool + tz map are bundled into the JS chunk, so the app shell
        // glob already carries the data; woff2 covers the subset fonts once a human
        // supplies them (docs/07 §7). Full offline after the first visit.
        globPatterns: ['**/*.{js,css,html,woff2,svg,json,webmanifest}'],
        // A subset font can exceed Workbox's 2 MiB default and would be dropped
        // from the precache *silently* — offline would then lose its typeface.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Unknown paths resolve to the app shell, which renders the translated
        // notFound view. /404.html is the host-level page and must serve itself.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/404\.html$/],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Tauri needs a fixed dev URL (tauri.conf.json devUrl → localhost:5173). On
  // `tauri android dev`, TAURI_DEV_HOST is the machine LAN IP so the phone can
  // reach the Vite server; HMR then talks back over that host.
  server: {
    port: 5173,
    strictPort: true,
    host: tauriDevHost ?? false,
    ...(tauriDevHost ? { hmr: { protocol: 'ws', host: tauriDevHost, port: 1421 } } : {}),
    watch: { ignored: ['**/src-tauri/**'] },
  },
  // Only override the build target for native webviews (WebView2 / Android System
  // WebView / WKWebView). The web/Cloudflare build keeps Vite's defaults.
  ...(tauriPlatform
    ? {
        build: {
          target: tauriPlatform === 'windows' ? 'chrome105' : 'safari13',
          minify: tauriDebug ? false : ('esbuild' as const),
          sourcemap: tauriDebug,
        },
      }
    : {}),
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Pure domain + lib only; UI shells (*.tsx) are excluded from the hard gate
      // (docs/11 §1) and covered by component/e2e tests instead.
      include: ['src/features/**/*.ts', 'src/lib/**/*.ts'],
      // Excluded: tests, type-only files, and thin I/O shells (storage adapters,
      // the canvas/OPFS import orchestration) that are verified in-browser, not by
      // unit tests (docs/11 §1 — shells are out of the hard gate).
      exclude: [
        '**/*.test.ts',
        '**/types.ts',
        '**/index.ts',
        'src/lib/storage/**',
        'src/features/background/import*.ts',
      ],
      thresholds: {
        // ≥80% overall on features + lib
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        // 100% line coverage on the critical pure modules (docs/11 §1)
        'src/lib/prng.ts': { lines: 100 },
        'src/features/quote/engine.ts': { lines: 100 },
        'src/features/quote/attribution.ts': { lines: 100 },
        'src/features/holidays/resolver.ts': { lines: 100 },
        'src/features/region/detect.ts': { lines: 100 },
        'src/features/clock/calendars/amlich.ts': { lines: 100 },
        'src/features/background/compressor.ts': { lines: 100 },
      },
    },
  },
});
