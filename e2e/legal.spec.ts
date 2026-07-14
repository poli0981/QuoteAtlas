import type { Page } from '@playwright/test';
import jaLegal from '../src/locales/ja/legal.json' with { type: 'json' };
import viLegal from '../src/locales/vi/legal.json' with { type: 'json' };
import { LEGAL_VERSION, S, clickToolbar, expect, readStore, seed, test } from './fixtures';

/**
 * The blocking legal gate (CLAUDE.md R11 / docs/06 §10): it can never be bypassed,
 * and any consentVersion that isn't the current LEGAL_VERSION re-gates the user.
 *
 * Two things are imported/defined locally rather than taken from `fixtures.ts`
 * (which must not be modified):
 *  - vi/ja `legal.json`: fixtures' `S` only carries EN, but the language-switch test
 *    must assert the *real* VI/JA copy, never a hardcoded literal.
 *  - `persistedSettings()`: fixtures' `readStore()` throws when nothing was ever
 *    written, and "nothing was ever written" is exactly the state a gated app must
 *    be in, so it needs to be an assertable value rather than an exception.
 */

const STORE_KEY = 'qa.settings.v1';

interface PersistedSettings {
  consentVersion?: number;
  uiLanguage?: string;
  favorites?: string[];
}

/** The persisted settings, or null if the store was never written at all. */
async function persistedSettings(page: Page): Promise<PersistedSettings | null> {
  const raw = await page.evaluate((key: string) => window.localStorage.getItem(key), STORE_KEY);
  return raw == null ? null : (JSON.parse(raw) as { state: PersistedSettings }).state;
}

/**
 * Hit-test the viewport: the gate is a `fixed inset-0` overlay, so if it truly blocks
 * the app, the topmost element under *every* sampled point — the quote, the toolbar
 * row, the header controls — belongs to the gate. `toBeVisible()` cannot show this
 * (Playwright ignores occlusion and the app renders behind the gate), while
 * `elementFromPoint` honours both stacking order and `pointer-events`, so this also
 * fails if the overlay is ever made click-through.
 */
async function appIsCoveredByGate(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const gate = document.querySelector('[role="dialog"]');
    if (!gate) return false;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const points: [number, number][] = [
      [w / 2, h / 2], // the quote
      [w / 2, h - 30], // the bottom toolbar
      [w - 30, 30], // the region picker / language buttons
      [8, 8],
    ];
    return points.every(([x, y]) => {
      const top = document.elementFromPoint(x, y);
      return top != null && gate.contains(top); // `contains` is true for the node itself
    });
  });
}

test.describe('legal gate', () => {
  test('blocks the app on a fresh visit (R11)', async ({ page }) => {
    await page.goto('/');

    const gate = page.getByRole('dialog');
    await expect(gate).toBeVisible();
    await expect(gate).toHaveAttribute('aria-modal', 'true');
    await expect(gate).toContainText(S.legal.title);
    await expect(gate).toContainText(S.legal.intro);
    await expect(gate.getByRole('button', { name: S.legal.agree })).toBeVisible();

    // the app really is rendered underneath — so "blocked" has to mean occluded,
    // not merely absent
    await expect(page.locator('figure blockquote')).not.toBeEmpty();
    expect(await appIsCoveredByGate(page)).toBe(true);

    // and nothing has been persisted yet: a gated user has no state at all
    expect(await persistedSettings(page)).toBeNull();
  });

  test('cannot be dismissed by Escape or a backdrop click (R11)', async ({ page }) => {
    await page.goto('/');
    const gate = page.getByRole('dialog');
    await expect(gate).toBeVisible();

    // the *only* controls the gate offers are the 3 language buttons + agree; any
    // added "skip"/"close"/"×" affordance would be an R11 bypass and trips this
    await expect(gate.getByRole('button')).toHaveCount(4);

    await page.keyboard.press('Escape');
    await expect(gate).toBeVisible();

    // top-start corner of the full-viewport overlay = backdrop, well clear of the card
    await gate.click({ position: { x: 4, y: 4 } });
    await expect(gate).toBeVisible();

    // and the app is still unreachable behind it
    expect(await appIsCoveredByGate(page)).toBe(true);

    // neither gesture recorded consent, so a reload re-gates
    await page.reload();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await appIsCoveredByGate(page)).toBe(true);
  });

  test('links the three legal documents at the repo', async ({ page }) => {
    await page.goto('/');
    const gate = page.getByRole('dialog');

    const license = gate.getByRole('link', { name: S.legal.sourceLicense });
    const terms = gate.getByRole('link', { name: S.legal.terms });
    const notices = gate.getByRole('link', { name: S.legal.notices });

    await expect(license).toHaveAttribute(
      'href',
      /^https:\/\/github\.com\/.+\/blob\/main\/LICENSE$/,
    );
    await expect(terms).toHaveAttribute('href', /^https:\/\/github\.com\/.+\/tree\/main\/legal$/);
    await expect(notices).toHaveAttribute(
      'href',
      /^https:\/\/github\.com\/.+\/blob\/main\/ATTRIBUTIONS\.md$/,
    );
    // all three must point at the same repo, so one stale link can't slip through
    await expect(gate.getByRole('link')).toHaveCount(3);

    // opening a legal doc must not navigate away from (and thus dismiss) the gate
    for (const link of [license, terms, notices]) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
  });

  test('agreeing reveals a usable app and persists consent across a reload', async ({ page }) => {
    await page.goto('/');
    const gate = page.getByRole('dialog');
    await expect(gate).toBeVisible();

    await gate.getByRole('button', { name: S.legal.agree }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    const quote = page.locator('figure blockquote');
    await expect(quote).toBeVisible();
    await expect(quote).not.toBeEmpty();

    // "revealed" must mean *interactive*, not just un-occluded: drive the toolbar and
    // watch the quote actually change. A gate left mounted (or any leftover overlay)
    // would swallow this click.
    const first = (await quote.textContent()) ?? '';
    expect(first).not.toBe('');
    await clickToolbar(page, S.settings.next);
    await expect(quote).not.toHaveText(first);

    expect((await readStore(page)).consentVersion).toBe(LEGAL_VERSION);

    // the persisted consent must survive a fresh boot — no second gate
    await page.reload();
    await expect(quote).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('re-gates a user whose accepted version is stale, keeping their other settings', async ({
    page,
  }) => {
    // a returning user with real settings, but consent for an older LEGAL_VERSION:
    // bumping the legal texts must put the gate back in front of them (R11)
    await seed(page, {
      consentVersion: LEGAL_VERSION - 1,
      uiLanguage: 'vi',
      favorites: ['en-0001'],
    });
    await page.goto('/');

    const gate = page.getByRole('dialog');
    await expect(gate).toBeVisible();
    // their persisted UI language still drives the gate's copy
    await expect(gate).toContainText(viLegal.title);
    expect(await appIsCoveredByGate(page)).toBe(true);

    // re-accepting upgrades the stored version and touches nothing else
    await gate.getByRole('button', { name: viLegal.agree }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const store = await readStore(page);
    expect(store.consentVersion).toBe(LEGAL_VERSION);
    expect(store.favorites).toEqual(['en-0001']);
    expect(store.uiLanguage).toBe('vi');
  });

  test('gates any consentVersion that is not the current one', async ({ page }) => {
    // Not just "0 means unaccepted": the check is an equality against LEGAL_VERSION, so
    // a store carrying some *other* version (tampered, rolled back, or written by a
    // future build) is gated too. An implementation that tested `consentVersion === 0`
    // or `< LEGAL_VERSION` would wave this user straight through.
    await seed(page, { consentVersion: LEGAL_VERSION + 1 });
    await page.goto('/');

    const gate = page.getByRole('dialog');
    await expect(gate).toBeVisible();
    expect(await appIsCoveredByGate(page)).toBe(true);

    await gate.getByRole('button', { name: S.legal.agree }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // accepting writes the *current* version, never leaves the foreign one in place
    expect((await readStore(page)).consentVersion).toBe(LEGAL_VERSION);
  });

  test('leaves the app inert to keyboard shortcuts while it is up (R11)', async ({ page }) => {
    // Regression: the gate is only a pointer overlay, so App.tsx's window-level
    // keydown handler (docs/06 §12) used to drive the app straight through it —
    // ArrowRight advanced the quote and `f` favorited + persisted it, all before
    // the user had accepted anything. The handler is now gated on consentVersion.
    await page.goto('/');
    const gate = page.getByRole('dialog');
    await expect(gate).toBeVisible();

    const quote = page.locator('figure blockquote');
    const shown = (await quote.textContent()) ?? '';
    expect(shown).not.toBe(''); // otherwise the "unchanged" assertion below is vacuous

    await page.keyboard.press('ArrowRight'); // next quote
    await page.keyboard.press('f'); // favorite

    // the gate blocks the pointer via its overlay; it must block the keyboard too
    await expect(quote).toHaveText(shown);
    await expect(gate).toBeVisible();
    expect(await appIsCoveredByGate(page)).toBe(true);

    // a gate that truly blocks never lets pre-consent state reach persistence: the
    // store is either untouched or, at worst, still holds no favorites
    expect(await persistedSettings(page)).toBeNull();
  });

  test('switches its own copy between EN, VI and JA, and remembers the choice', async ({
    page,
  }) => {
    await page.goto('/');
    const gate = page.getByRole('dialog');
    // the gate's language buttons are labelled by the raw language code (EN/VI/JA),
    // unlike the header's, which use the endonyms — so an exact-name match is unambiguous
    const lang = (code: string) => gate.getByRole('button', { name: code, exact: true });

    await expect(gate).toContainText(S.legal.title);
    await expect(lang('EN')).toHaveAttribute('aria-pressed', 'true');

    await lang('VI').click();
    await expect(gate).toContainText(viLegal.title);
    await expect(gate).toContainText(viLegal.intro);
    await expect(gate.getByRole('button', { name: viLegal.agree })).toBeVisible();
    await expect(gate).not.toContainText(S.legal.intro);
    await expect(lang('VI')).toHaveAttribute('aria-pressed', 'true');
    await expect(lang('EN')).toHaveAttribute('aria-pressed', 'false');

    await lang('JA').click();
    await expect(gate).toContainText(jaLegal.title);
    await expect(gate).toContainText(jaLegal.intro);
    await expect(gate.getByRole('button', { name: jaLegal.agree })).toBeVisible();
    await expect(lang('JA')).toHaveAttribute('aria-pressed', 'true');
    await expect(lang('VI')).toHaveAttribute('aria-pressed', 'false');

    // picking a language writes settings but must NOT smuggle in consent…
    const store = await readStore(page);
    expect(store.uiLanguage).toBe('ja');
    expect(store.consentVersion).toBe(0);
    await expect(gate).toBeVisible();

    // …and the choice survives the reload that the still-unconsented user gets
    await page.reload();
    const reloaded = page.getByRole('dialog');
    await expect(reloaded).toBeVisible();
    await expect(reloaded).toContainText(jaLegal.title);

    await reloaded.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(reloaded).toContainText(S.legal.title);
    await expect(reloaded.getByRole('button', { name: S.legal.agree })).toBeVisible();
  });
});
