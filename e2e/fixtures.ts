import { deflateSync } from 'node:zlib';
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

/**
 * Resolve once React's mount effects have flushed.
 *
 * The window-level `keydown` listener (docs/06 §12) is attached by an effect, so a
 * key pressed before that commit lands is *silently dropped* — Playwright is fast
 * enough to lose that race (webkit most of all); a human never is. The region
 * picker reads "Auto" until the detect() effect resolves and is attached in the
 * same commit, so its label is a precise signal that effects have run.
 */
export async function waitForInteractive(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: S.common.region.auto, exact: true })).toHaveCount(
    0,
  );
}

/** Open the settings drawer and return its dialog locator. */
export async function openSettings(page: Page): Promise<Locator> {
  await clickToolbar(page, S.settings.open);
  const panel = page.getByRole('dialog', { name: S.settings.title });
  await expect(panel).toBeVisible();
  return panel;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * A real, valid 1×1 PNG in the given colour — enough to drive the whole import
 * pipeline (sniff → decode → OPFS).
 *
 * The colour is what makes the FILE BYTES differ, and that matters: import dedups
 * on the SHA-256 of the picked file, so two uploads of the same colour are one
 * item on purpose. Any spec that wants N distinct items must pass N distinct
 * colours (a hand-rolled encoder, because there is no other way to vary the bytes
 * while staying a decodable PNG).
 */
export function tinyPng(color: [number, number, number] = [22, 160, 133]): {
  name: string;
  mimeType: string;
  buffer: Buffer;
} {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); // width
  ihdr.writeUInt32BE(1, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour (RGB)
  const scanline = Buffer.from([0, ...color]); // filter byte 0 + one RGB pixel
  const buffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(scanline)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return { name: `dot-${color.join('-')}.png`, mimeType: 'image/png', buffer };
}

/**
 * Every spec boots on this fixed instant.
 *
 * The app narrows the quote pool to holiday-tagged quotes whenever a holiday is
 * active (docs/05 §2). On 1 Jan the international `new-year` tag leaves exactly
 * one quote in the seed pool, so prev/next genuinely cannot move and half the
 * suite would fail — one day a year, in CI, for a real reason. Pin a boring
 * holiday-free date rather than depend on the calendar.
 *
 * `setFixedTime` (NOT `clock.install`) on purpose: install() also fakes
 * setTimeout/requestAnimationFrame, and on WebKit that stops React from flushing a
 * state update made from a NON-React listener — i.e. the window `keydown` handler
 * (docs/06 §12). Clicks still worked (React's own discrete events), so every
 * keyboard spec silently broke while the rest stayed green. setFixedTime pins Date
 * and leaves the real timers alone.
 */
const FIXED_NOW = new Date('2026-06-15T09:30:00+07:00');

/**
 * `app` = a booted page with consent already accepted, so specs don't re-drive the
 * blocking legal gate (legal.spec.ts covers the gate itself).
 *
 * `fixedTime` opts a spec out of the pinned clock — boot.spec needs real time to
 * prove the clock actually ticks.
 */
export const test = base.extend<{ app: Page; fixedTime: boolean }>({
  fixedTime: [true, { option: true }],
  page: async ({ page, fixedTime }, run) => {
    if (fixedTime) await page.clock.setFixedTime(FIXED_NOW);
    await run(page);
  },
  app: async ({ page }, run) => {
    await seed(page, { consentVersion: LEGAL_VERSION });
    await page.goto('/');
    // the gate is the only dialog at boot — if consent seeding broke, this trips
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await waitForInteractive(page);
    await run(page);
  },
});

export { expect };
