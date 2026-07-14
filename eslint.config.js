// @ts-check
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint 9 flat config. Encodes several CLAUDE.md hard rules as lint (docs/10 §1):
 *  - R1: `fetch` only under src/features/updater/**; `navigator.geolocation` banned.
 *  - docs/07 §6: physical direction utilities/props banned in src/ (logical only).
 *  - docs/02 §2: import boundaries (downward only) + pure-domain files import no
 *    DOM/React/Tauri.
 */

/** Pure-domain modules that must not import DOM/React/Tauri/UI libs (docs/10 §1). */
const DOMAIN_FILES = [
  'src/features/quote/engine.ts',
  'src/features/quote/attribution.ts',
  'src/features/holidays/resolver.ts',
  'src/features/region/detect.ts',
  'src/features/background/limits.ts',
  'src/features/background/compressor.ts',
  'src/features/clock/calendars/amlich.ts',
  'src/lib/prng.ts',
];

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'src-tauri/',
      'public/fonts/',
      'src/features/region/tz-to-country.json',
    ],
  },

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  jsxA11y.flatConfigs.recommended,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Interpolating numbers into strings is normal and safe.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],

      // R1 — privacy: geolocation is banned entirely (docs/09).
      'no-restricted-properties': [
        'error',
        {
          object: 'navigator',
          property: 'geolocation',
          message:
            'R1: navigator.geolocation is banned (docs/09 §10). Use timezone + language + manual picker.',
        },
      ],
      // R1 — network fencing: fetch only allowed under src/features/updater/** (re-enabled below).
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'R1: fetch is only allowed under src/features/updater/ (docs/02 §7).',
        },
      ],
    },
  },

  // R1 — re-allow fetch inside the updater feature (the one network module).
  {
    files: ['src/features/updater/**'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },

  // docs/07 §6 — ban physical-direction Tailwind utilities / CSS props in src/.
  // Catches static className string literals; dynamic (clsx/template) cases are a
  // documented coverage gap (supplement with a grep lint-script if needed).
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/(^|\\s)(-?(pl|pr|ml|mr|left|right|border-l|border-r|rounded-l|rounded-r|text-left|text-right|float-left|float-right))-/]',
          message:
            'docs/07 §6: use CSS logical utilities (ps-/pe-/ms-/me-/start-/end-/text-start/text-end), not physical left/right.',
        },
      ],
    },
  },

  // docs/02 §2 — import boundaries: downward only. features/lib must not import
  // from app (the app shell itself may import features/lib).
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app', '**/app/**'],
              message: 'docs/02 §2: features/lib must not import from app (downward only).',
            },
          ],
        },
      ],
    },
  },

  // docs/10 §1 — pure-domain files: no DOM/React/Tauri/UI-lib imports (+ app ban).
  {
    files: DOMAIN_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app', '**/app/**'],
              message: 'docs/02 §2: domain modules must not import from app (downward only).',
            },
            {
              group: [
                'react',
                'react-dom',
                'react/*',
                'react-dom/*',
                '@tauri-apps/*',
                'motion',
                'motion/*',
                'zustand',
                'zustand/*',
                'i18next',
                'react-i18next',
              ],
              message: 'docs/10 §1: domain modules import no DOM/React/Tauri/UI libs (pure TS).',
            },
          ],
        },
      ],
    },
  },

  // Tests & build scripts: relax a few type-checked strictnesses.
  {
    files: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },

  // Decorative, muted background videos — captions do not apply (docs/06 §3).
  {
    files: [
      'src/features/background/BackgroundLayer.tsx',
      'src/features/background/SlideshowPlayer.tsx',
    ],
    rules: {
      'jsx-a11y/media-has-caption': 'off',
    },
  },

  // Plain JS config files: disable type-checked rules (not in the TS program).
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
