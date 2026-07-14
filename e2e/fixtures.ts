import { test as base, expect, type Locator, type Page } from '@playwright/test';
import common from '../src/locales/en/common.json' with { type: 'json' };
import errors from '../src/locales/en/errors.json' with { type: 'json' };
import legal from '../src/locales/en/legal.json' with { type: 'json' };
import media from '../src/locales/en/media.json' with { type: 'json' };
import settings from '../src/locales/en/settings.json' with { type: 'json' };

/**
 * EN locale strings are *imported*, never copied, so a spec can't drift from the
 * UI it asserts on (docs/07 §1: en is the source of truth).
 */
export const S = { common, errors, legal, media, settings };

/** Fill an i18next `{{var}}` template the way the UI would. */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? '');
}

/** zustand-persist key; LEGAL_VERSION must track src/features/legal/legal-version.ts. */
const STORE_KEY = 'qa.settings.v1';
export const LEGAL_VERSION = 1;

export interface SeedState {
  consentVersion?: number;
  uiLanguage?: 'en' | 'vi' | 'ja';
  quoteMode?: 'per-load' | 'daily' | 'rotate';
  regionOverride?: string | null;
  favorites?: string[];
  background?: Record<string, unknown>;
}

/**
 * Seed persisted settings *before* the app boots. The store's `merge` deep-merges
 * over DEFAULT_SETTINGS, so a partial patch is enough.
 */
export async function seed(page: Page, state: SeedState): Promise<void> {
  await page.addInitScript(
    (arg: { key: string; value: string }) => {
      window.localStorage.setItem(arg.key, arg.value);
    },
    { key: STORE_KEY, value: JSON.stringify({ state, version: 1 }) },
  );
}

/** Read the persisted settings back out (asserts the store actually wrote). */
export async function readStore(page: Page): Promise<Record<string, unknown>> {
  const raw = await page.evaluate((key: string) => window.localStorage.getItem(key), STORE_KEY);
  if (raw == null) throw new Error('settings were never persisted');
  return (JSON.parse(raw) as { state: Record<string, unknown> }).state;
}

/**
 * The bottom toolbar fades out after 3 s idle and becomes `pointer-events: none`
 * (docs/06 §1), so a plain click can land on a dead element. Nudge the pointer to
 * wake it, then click — retried as a unit so a slow paint can't flake the test.
 */
export async function clickToolbar(page: Page, name: string): Promise<void> {
  const button = page.getByRole('button', { name, exact: true });
  await expect(async () => {
    await page.mouse.move(600, 400);
    await page.mouse.move(601, 401);
    await button.click({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/** Open the settings drawer and return its dialog locator. */
export async function openSettings(page: Page): Promise<Locator> {
  await clickToolbar(page, S.settings.open);
  const panel = page.getByRole('dialog', { name: S.settings.title });
  await expect(panel).toBeVisible();
  return panel;
}

/** A real 1×1 PNG — enough for the import pipeline (sniff → decode → OPFS). */
export function tinyPng(): { name: string; mimeType: string; buffer: Buffer } {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  return { name: 'dot.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

/**
 * Every spec boots at this fixed instant.
 *
 * The app narrows the quote pool to holiday-tagged quotes whenever a holiday is
 * active (docs/05 §2). On 1 Jan the international `new-year` tag leaves exactly
 * one quote in the seed pool, so prev/next genuinely cannot move and half the
 * suite would fail — one day a year, in CI, for a real reason. Pin a boring
 * holiday-free date rather than depend on the calendar. Time still flows from
 * here (clock.resume), so the live clock keeps ticking.
 */
const FIXED_NOW = new Date('2026-06-15T09:30:00+07:00');

/**
 * `app` = a booted page with consent already accepted, so specs don't re-drive the
 * blocking legal gate (legal.spec.ts covers the gate itself).
 */
export const test = base.extend<{ app: Page }>({
  page: async ({ page }, run) => {
    await page.clock.install({ time: FIXED_NOW });
    await page.clock.resume();
    await run(page);
  },
  app: async ({ page }, run) => {
    await seed(page, { consentVersion: LEGAL_VERSION });
    await page.goto('/');
    // the gate is the only dialog at boot — if consent seeding broke, this trips
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await run(page);
  },
});

export { expect };
