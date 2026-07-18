import { S, expect, fill, test } from './fixtures';

/** Boot flow (docs/03 §1): settings → legal gate → region → locale chain → quote. */
test.describe('boot', () => {
  // Real wall-clock here: the rest of the suite pins Date to a holiday-free day, but
  // a pinned Date can never *advance*, and the whole point below is that it does.
  // Nothing in this describe depends on the pool size, so the calendar can't bite.
  test.use({ fixedTime: false });

  test('renders a quote with its attribution line', async ({ app }) => {
    const quote = app.locator('blockquote');
    await expect(quote).toBeVisible();
    await expect(quote).not.toBeEmpty();
    // the seed pool is `en`, so the quote element is tagged as such
    await expect(quote).toHaveAttribute('lang', 'en');
    await expect(app.locator('figcaption')).toContainText('—');
  });

  test('surfaces the locale fallback rather than failing silently (R4)', async ({ app }) => {
    // timezone Asia/Bangkok ⇒ detect() = TH, which has no native pool ⇒ en + banner
    const banner = fill(S.common.region.fallback, { locale: 'English', region: 'Thailand' });
    await expect(app.getByText(banner)).toBeVisible();
  });

  test('shows a clock that actually ticks', async ({ app }) => {
    const clock = app.locator('header > div').first();
    await expect(clock).toContainText(/\d{1,2}:\d{2}:\d{2}/);
    const first = (await clock.textContent()) ?? '';
    // the seconds must advance — a frozen clock would keep the same text
    await expect(clock).not.toHaveText(first, { timeout: 5_000 });
  });
});
