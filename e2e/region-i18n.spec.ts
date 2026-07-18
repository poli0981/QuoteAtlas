import type { Locator, Page } from '@playwright/test';
import indexData from '../data/quotes/index.json' with { type: 'json' };
import tzData from '../src/features/region/tz-to-country.json' with { type: 'json' };
import viCommon from '../src/locales/vi/common.json' with { type: 'json' };
import { LEGAL_VERSION, S, expect, fill, readStore, seed, test } from './fixtures';

/**
 * Region picker + UI language (docs/03 §2, docs/06 §6, docs/07).
 *
 * The config pins Asia/Bangkok + en-US, so detect() resolves TH, which has no
 * native pool — every test starts on the locale-fallback path to `en` (R4).
 * (VN/JP/KR/CN now ship pools, so TH/EG stand in for the pool-less regions.)
 */

/** Every region the picker must offer: the tz map ∪ the pool regions, both from shipped data. */
const ALL_REGIONS = [
  ...new Set<string>([
    ...Object.values(tzData.map),
    ...indexData.locales.flatMap((l) => l.regions),
  ]),
];

/** Regions that really have a native pool, straight from the shipped index. */
const POOL_REGIONS = new Set<string>(indexData.locales.flatMap((l) => l.regions));

/**
 * Expected display names computed from Node's own ICU — an oracle independent of the
 * app, so these assertions still fail if the app stops localizing (or localizes with
 * the wrong language), instead of just echoing whatever the app rendered.
 */
function regionName(code: string, uiLanguage = 'en'): string {
  return new Intl.DisplayNames([uiLanguage], { type: 'region' }).of(code) ?? code;
}
function languageName(code: string, uiLanguage = 'en'): string {
  return new Intl.DisplayNames([uiLanguage], { type: 'language' }).of(code) ?? code;
}

/**
 * The exact R4 banner the app must render for (pool locale, chosen region) — interpolations
 * and all. Asserting the *filled* string (not a wildcard regex) is what proves App.tsx feeds
 * the banner Intl names in the current UI language rather than raw codes or English.
 */
function bannerText(locale: string, region: string, uiLanguage: 'en' | 'vi' = 'en'): string {
  const template = uiLanguage === 'vi' ? viCommon.region.fallback : S.common.region.fallback;
  return fill(template, {
    locale: languageName(locale, uiLanguage),
    region: regionName(region, uiLanguage),
  });
}

/** Turn an i18next template into a regex that matches it with *any* interpolations. */
function templateRe(template: string): RegExp {
  return new RegExp(
    template
      .split(/\{\{\w+\}\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.+'),
  );
}

/** ANY fallback banner, whatever it names — so `toHaveCount(0)` means gone, not merely reworded. */
function anyBanner(page: Page): Locator {
  return page.getByText(templateRe(S.common.region.fallback));
}

/** The picker's toggle button; located structurally because its label *is* the assertion. */
function pickerToggle(page: Page): Locator {
  return page.locator('header button[aria-haspopup="listbox"]');
}

function searchBox(page: Page, label: string = S.common.region.search): Locator {
  return page.getByRole('textbox', { name: label });
}

async function openPicker(page: Page): Promise<Locator> {
  await pickerToggle(page).click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  return listbox;
}

/** The trailing <span> of an option row holds the `US ✓` / bare `EG` pool marker. */
function optionMarker(option: Locator): Locator {
  return option.locator('span').last();
}

test.describe('region + i18n', () => {
  test('detects Thailand from the timezone and surfaces the locale fallback (R4)', async ({
    app,
  }) => {
    // data guard: the whole spec is built on TH having no native pool
    expect(POOL_REGIONS.has('TH')).toBe(false);

    // detection ran: the toggle names the country, not the untouched "Auto" placeholder
    await expect(pickerToggle(app)).toHaveAccessibleName(regionName('TH'));
    await expect(pickerToggle(app)).not.toHaveAccessibleName(S.common.region.auto);

    // …and because TH has no pool, the app must SAY it fell back to English — never silently
    await expect(app.getByText(bannerText('en', 'TH'), { exact: true })).toBeVisible();
  });

  test('searching the picker narrows the list and choosing a country persists regionOverride', async ({
    app,
  }) => {
    const listbox = await openPicker(app);
    const options = listbox.getByRole('option');
    // unfiltered, the picker offers every region the app knows about — this is the
    // baseline that gives "narrows" below its teeth: without filtering it stays full
    await expect(options).toHaveCount(ALL_REGIONS.length);
    expect(ALL_REGIONS.length).toBeGreaterThan(1);

    await searchBox(app).fill('egypt');
    await expect(options).toHaveCount(1);
    const egypt = options.first();
    await expect(egypt).toContainText(regionName('EG'));
    // EG is absent from data/quotes/index.json (guard below), so the row shows a BARE code
    expect(POOL_REGIONS.has('EG')).toBe(false);
    await expect(optionMarker(egypt)).toHaveText('EG');

    await egypt.click();
    await expect(listbox).toBeHidden();
    await expect(pickerToggle(app)).toHaveAccessibleName(regionName('EG'));
    // EG has no pool either, so R4 still applies — the banner now names Egypt, not Thailand
    await expect(app.getByText(bannerText('en', 'EG'), { exact: true })).toBeVisible();
    await expect(app.getByText(bannerText('en', 'TH'), { exact: true })).toHaveCount(0);

    expect(await readStore(app)).toMatchObject({ regionOverride: 'EG' });

    // reopening: choose() cleared the query (full list again) and EG is the sole selected option
    const reopened = await openPicker(app);
    await expect(reopened.getByRole('option')).toHaveCount(ALL_REGIONS.length);
    await expect(searchBox(app)).toHaveValue('');
    const selected = reopened.locator('[role="option"][aria-selected="true"]');
    await expect(selected).toHaveCount(1);
    await expect(selected).toContainText(regionName('EG'));
  });

  test('choosing a region backed by a pool hides the fallback banner', async ({ app }) => {
    // data guard: the `en` pool claims US, so US must resolve natively
    expect(POOL_REGIONS.has('US')).toBe(true);
    await expect(app.getByText(bannerText('en', 'TH'), { exact: true })).toBeVisible();

    const listbox = await openPicker(app);
    await searchBox(app).fill('United States');
    const options = listbox.getByRole('option');
    await expect(options).toHaveCount(1);
    const us = options.first();
    // the ✓ marker is the only hint a region has a native pool — it must not silently drop
    await expect(optionMarker(us)).toHaveText('US ✓');
    await us.click();

    await expect(pickerToggle(app)).toHaveAccessibleName(regionName('US'));
    // no fallback AT ALL — not a banner that merely renamed its region
    await expect(anyBanner(app)).toHaveCount(0);
    expect(await readStore(app)).toMatchObject({ regionOverride: 'US' });

    const reopened = await openPicker(app);
    await expect(reopened.locator('[role="option"][aria-selected="true"]')).toContainText(
      regionName('US'),
    );
  });

  test('reset to auto-detect clears the override and re-detects Thailand', async ({ page }) => {
    // boot already overridden to a pool-backed region, so "reset" has something to undo
    await seed(page, { consentVersion: LEGAL_VERSION, regionOverride: 'US' });
    await page.goto('/');
    // proves the app rendered *and* honoured the seed before we assert the banner's absence
    await expect(pickerToggle(page)).toHaveAccessibleName(regionName('US'));
    await expect(anyBanner(page)).toHaveCount(0);

    const listbox = await openPicker(page);
    await listbox.getByRole('button', { name: S.common.region.reset }).click();
    await expect(listbox).toBeHidden();

    // override cleared → the detected region (TH) takes over again, fallback and all
    await expect(pickerToggle(page)).toHaveAccessibleName(regionName('TH'));
    await expect(page.getByText(bannerText('en', 'TH'), { exact: true })).toBeVisible();
    expect(await readStore(page)).toMatchObject({ regionOverride: null });
  });

  test('switching the UI language re-renders the chrome in Vietnamese, not the quote', async ({
    app,
  }) => {
    // settle on the detected region first, so the quote we snapshot is the post-detection one
    // (the daily pick is keyed on region-derived holiday tags, App.tsx → useQuoteStack)
    await expect(app.getByText(bannerText('en', 'TH'), { exact: true })).toBeVisible();

    const quote = app.locator('blockquote');
    const before = await quote.textContent();
    expect(before?.trim().length ?? 0).toBeGreaterThan(0);

    // the language buttons keep their endonyms in every bundle, so these locators survive the switch
    const enButton = app.getByRole('button', { name: S.common.language.en, exact: true });
    const viButton = app.getByRole('button', { name: S.common.language.vi, exact: true });
    await expect(enButton).toHaveAttribute('aria-pressed', 'true');

    await viButton.click();

    await expect(viButton).toHaveAttribute('aria-pressed', 'true');
    await expect(enButton).toHaveAttribute('aria-pressed', 'false');

    // chrome flips to the vi bundle: the language group's own label is the cheapest proof
    await expect(app.getByRole('group', { name: viCommon.language.label })).toBeVisible();
    await expect(app.getByRole('group', { name: S.common.language.label })).toHaveCount(0);

    // …and the Intl-derived names follow the UI language too: "Thái Lan", not "Thailand"
    await expect(pickerToggle(app)).toHaveAccessibleName(regionName('TH', 'vi'));
    // the R4 banner is re-rendered from the vi template AND re-interpolated with vi names
    await expect(app.getByText(bannerText('en', 'TH', 'vi'), { exact: true })).toBeVisible();
    await expect(app.getByText(bannerText('en', 'TH'), { exact: true })).toHaveCount(0);

    // the picker's internals come from the vi bundle as well
    const listbox = await openPicker(app);
    await expect(searchBox(app, viCommon.region.search)).toBeVisible();
    await expect(listbox.getByRole('button', { name: viCommon.region.reset })).toBeVisible();
    await pickerToggle(app).click(); // close it again so it can't cover the quote
    await expect(listbox).toBeHidden();

    // the quote pool is independent of the UI language (docs/07): same text, still lang="en"
    await expect(quote).toHaveAttribute('lang', 'en');
    await expect(quote).toHaveText(before ?? '');
    expect(await readStore(app)).toMatchObject({ uiLanguage: 'vi' });
  });
});
