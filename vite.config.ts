import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

// PWA (vite-plugin-pwa) is wired in M4; kept out of the toolchain baseline.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Pure domain + lib only; UI shells (*.tsx) are excluded from the hard gate
      // (docs/11 §1) and covered by component/e2e tests instead.
      include: ['src/features/**/*.ts', 'src/lib/**/*.ts'],
      exclude: ['**/*.test.ts', '**/types.ts', '**/index.ts'],
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
