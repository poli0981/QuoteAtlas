import viCommon from '../src/locales/vi/common.json' with { type: 'json' };
import { S, expect, seed, test } from './fixtures';

/**
 * The regional calendar line (docs/07 §4) — the clock's second line.
 *
 * The suite's pinned instant is 2026-06-15T09:30:00+07:00, which is lunar
 * 1/5 Bính Ngọ in Vietnam. Pinning matters here beyond determinism: the line is
 * memoised per calendar day, so a test that straddled midnight would be asserting
 * on a value computed for the previous one.
 */
const TH_DEFAULT_REGION = 'Thailand';

test.describe('regional calendar line', () => {
  test('Vietnam gets the in-house lunar date, labelled and localised (R8)', async ({ page }) => {
    await seed(page, { consentVersion: 1, regionOverride: 'VN', uiLanguage: 'vi' });
    await page.goto('/');

    const header = page.locator('header');
    // Not Intl's `chinese` calendar: that computes at UTC+8 and is what R8 bans.
    // The label is imported from the VI bundle, not copied — S is the EN one.
    await expect(header).toContainText(`${viCommon.calendar.lunarVi}: ngày 1 tháng Năm, Bính Ngọ`);
  });

  test('keeps the lunar label in the chosen UI language', async ({ page }) => {
    await seed(page, { consentVersion: 1, regionOverride: 'VN', uiLanguage: 'en' });
    await page.goto('/');

    // The date itself stays Vietnamese — it is a Vietnamese calendar — but the
    // label follows the UI language.
    await expect(page.locator('header')).toContainText(
      `${S.common.calendar.lunarVi}: ngày 1 tháng Năm`,
    );
  });

  test('shows the era calendar for Japan and Thailand', async ({ page }) => {
    for (const [region, expected] of [
      ['JP', /Reiwa/],
      ['TH', /BE|2569/],
    ] as const) {
      await seed(page, { consentVersion: 1, regionOverride: region, uiLanguage: 'en' });
      await page.goto('/');
      await expect(page.locator('header'), region).toContainText(expected);
    }
  });

  test('hides the line for a region with no second calendar', async ({ page }) => {
    await seed(page, { consentVersion: 1, regionOverride: 'US', uiLanguage: 'en' });
    await page.goto('/');

    const clock = page.locator('header > div').first();
    // One line only — a second Gregorian date would be noise, not information.
    await expect(clock.locator('div')).toHaveCount(1);
    await expect(clock).not.toContainText('Lunar');
  });

  test('does not disturb the Gregorian line it sits under', async ({ app }) => {
    // Default detection is Thailand, which does have a second calendar — the
    // first line must still be the ticking local date/time.
    await expect(app.locator('header')).toContainText(TH_DEFAULT_REGION);
    const clock = app.locator('header > div').first();
    await expect(clock).toContainText(/\d{1,2}:\d{2}:\d{2}/);
  });
});
