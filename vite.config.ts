import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import pkg from './package.json';

// Offline-first PWA (docs/08 §5): precache the app shell + bundled data + fonts;
// `prompt` surfaces a reload toast on SW update rather than auto-reloading.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'QuoteAtlas',
        short_name: 'QuoteAtlas',
        description: 'Ambient quote display — offline-first.',
        lang: 'en',
        theme_color: '#0f172a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,json}'],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
