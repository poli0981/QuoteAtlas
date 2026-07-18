import type { Page } from '@playwright/test';
import enData from '../data/quotes/en.json' with { type: 'json' };
import type { QuoteRecord } from '../src/features/quote/types';
import {
  LEGAL_VERSION,
  S,
  clickToolbar,
  expect,
  readStore,
  seed,
  test,
  waitForInteractive,
} from './fixtures';

/**
 * Quote display, session-stack navigation and favorites (docs/05 §2, docs/06 §11/§12).
 *
 * The shipped `en` pool is imported (not transcribed) so a spec can map the rendered
 * text back to its record — the store persists quote *ids*, which never reach the DOM,
 * and the attribution shape is per-record. No fixture exposes this, so it lives here.
 */
const POOL = enData.quotes as unknown as QuoteRecord[];

function quote(page: Page) {
  return page.locator('blockquote');
}

async function quoteText(page: Page): Promise<string> {
  await expect(quote(page)).not.toBeEmpty();
  return ((await quote(page).textContent()) ?? '').trim();
}

/** The pool record currently on screen — throws if the UI renders something foreign. */
async function currentRecord(page: Page): Promise<QuoteRecord> {
  const text = await quoteText(page);
  const record = POOL.find((q) => q.text === text);
  if (!record) throw new Error(`rendered quote is not in the en pool: "${text}"`);
  return record;
}

/**
 * The attribution a record must render, derived straight from the raw JSON per the
 * locked segment order (docs/04 §5). Deliberately NOT computed with
 * src/features/quote/attribution.ts: reusing the app's own formatter would make the
 * assertion agree with itself if that formatter regressed.
 */
function expectedAttribution(record: QuoteRecord): { label: string; href?: string } {
  const a = record.attribution;
  switch (record.type) {
    case 'proverb': {
      if (a.source == null) throw new Error(`proverb ${record.id} has no source to attribute`);
      return { label: a.source };
    }
    case 'quote': {
      const label = a.author ?? a.source;
      if (label == null) throw new Error(`quote ${record.id} has no author/source to attribute`);
      // only an author segment may carry a link (docs/04 §5)
      return a.author != null && a.links.author != null
        ? { label, href: a.links.author }
        : { label };
    }
    default:
      throw new Error(
        `the en pool grew a '${record.type}' record — extend expectedAttribution (docs/04 §5)`,
      );
  }
}

test.describe('quote navigation', () => {
  test('next pushes a new quote, prev walks back, and prev is dead at the stack root', async ({
    app,
  }) => {
    const prev = app.getByRole('button', { name: S.settings.prev, exact: true });
    const first = await quoteText(app);

    // pos 0 of the session stack: there is nothing behind the boot quote
    await expect(prev).toBeDisabled();

    await clickToolbar(app, S.settings.next);
    await expect(quote(app)).not.toHaveText(first);
    const second = await quoteText(app);
    await expect(prev).toBeEnabled();

    // prev must replay the stack, not re-pick: the exact boot quote comes back
    await clickToolbar(app, S.settings.prev);
    await expect(quote(app)).toHaveText(first);
    await expect(prev).toBeDisabled();

    // and next walks forward through the stack it already holds
    await clickToolbar(app, S.settings.next);
    await expect(quote(app)).toHaveText(second);

    // only past the top of the stack does next pick a *fresh* quote
    await clickToolbar(app, S.settings.next);
    await expect(quote(app)).not.toHaveText(second);
    await expect(quote(app)).not.toHaveText(first);
  });

  test('ArrowRight / ArrowLeft drive the same session stack as the toolbar', async ({ app }) => {
    const prev = app.getByRole('button', { name: S.settings.prev, exact: true });
    const first = await quoteText(app);

    await app.keyboard.press('ArrowRight');
    await expect(quote(app)).not.toHaveText(first);
    // the toolbar button reflects the keyboard move ⇒ same stack, not a parallel one
    await expect(prev).toBeEnabled();
    const second = await quoteText(app);

    await app.keyboard.press('ArrowLeft');
    await expect(quote(app)).toHaveText(first);
    await expect(prev).toBeDisabled();

    await app.keyboard.press('ArrowRight');
    await expect(quote(app)).toHaveText(second);
  });
});

test.describe('favorites', () => {
  test('the heart toggles aria-pressed and persists the quote id', async ({ app }) => {
    const record = await currentRecord(app);
    const off = app.getByRole('button', { name: S.settings.favorite, exact: true });
    const on = app.getByRole('button', { name: S.settings.unfavorite, exact: true });

    await expect(off).toHaveAttribute('aria-pressed', 'false');
    await expect(off).toHaveText('♡');
    // (no store assertion yet: zustand-persist only writes the full state on the first
    // `set()`, so `favorites` is simply absent from the seeded blob until we toggle)

    await clickToolbar(app, S.settings.favorite);
    // the label flips to "remove favorite" — same button, pressed state
    await expect(on).toHaveAttribute('aria-pressed', 'true');
    await expect(on).toHaveText('♥');
    await expect.poll(async () => (await readStore(app)).favorites).toEqual([record.id]);

    await clickToolbar(app, S.settings.unfavorite);
    await expect(off).toHaveAttribute('aria-pressed', 'false');
    await expect(off).toHaveText('♡');
    await expect.poll(async () => (await readStore(app)).favorites).toEqual([]);
  });

  test('the heart tracks the shown quote, not a global "any favorites" flag', async ({ app }) => {
    const off = app.getByRole('button', { name: S.settings.favorite, exact: true });
    const on = app.getByRole('button', { name: S.settings.unfavorite, exact: true });
    const first = await currentRecord(app);

    await clickToolbar(app, S.settings.favorite);
    await expect(on).toHaveAttribute('aria-pressed', 'true');

    // stepping onto a *different*, unfavorited quote must clear the pressed state —
    // this is what a `favorites.length > 0` implementation would get wrong
    await clickToolbar(app, S.settings.next);
    const second = await currentRecord(app);
    expect(second.id).not.toBe(first.id);
    await expect(off).toHaveAttribute('aria-pressed', 'false');
    await expect(off).toHaveText('♡');

    // favoriting here must add the *shown* id, not re-toggle the first one
    await clickToolbar(app, S.settings.favorite);
    await expect(on).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await readStore(app)).favorites).toEqual([first.id, second.id]);

    // walking back re-marks the first quote as favorited
    await clickToolbar(app, S.settings.prev);
    await expect(quote(app)).toHaveText(first.text);
    await expect(on).toHaveAttribute('aria-pressed', 'true');

    // …and unfavoriting it leaves the second one untouched
    await clickToolbar(app, S.settings.unfavorite);
    await expect(off).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await readStore(app)).favorites).toEqual([second.id]);
  });

  test('pressing f toggles the favorite for the shown quote', async ({ app }) => {
    const record = await currentRecord(app);
    const on = app.getByRole('button', { name: S.settings.unfavorite, exact: true });
    const off = app.getByRole('button', { name: S.settings.favorite, exact: true });

    await app.keyboard.press('f');
    await expect(on).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await readStore(app)).favorites).toEqual([record.id]);

    await app.keyboard.press('f');
    await expect(off).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await readStore(app)).favorites).toEqual([]);
  });

  test('a seeded favorite boots as already favorited', async ({ page }) => {
    await seed(page, { consentVersion: LEGAL_VERSION, quoteMode: 'daily' });
    await page.goto('/');
    // daily mode is stable for the whole local day, so re-seeding *this* id and
    // rebooting lands on the same quote — now pre-favorited before first paint.
    const { id } = await currentRecord(page);

    await seed(page, { consentVersion: LEGAL_VERSION, quoteMode: 'daily', favorites: [id] });
    await page.goto('/');

    await expect(page.getByRole('button', { name: S.settings.favorite, exact: true })).toHaveCount(
      0,
    );
    const on = page.getByRole('button', { name: S.settings.unfavorite, exact: true });
    await expect(on).toHaveAttribute('aria-pressed', 'true');
    await expect(on).toHaveText('♥');
    expect((await currentRecord(page)).id).toBe(id);

    // a *different* quote in the same session must not inherit the pressed state,
    // so the seeded id is really matched against the shown quote
    await clickToolbar(page, S.settings.next);
    expect((await currentRecord(page)).id).not.toBe(id);
    await expect(
      page.getByRole('button', { name: S.settings.favorite, exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('quote modes', () => {
  test('daily mode yields the same quote on every reload', async ({ page }) => {
    await seed(page, { consentVersion: LEGAL_VERSION, quoteMode: 'daily' });
    await page.goto('/');
    const first = await quoteText(page);
    expect(POOL.map((q) => q.text)).toContain(first);

    // The daily seed is date+locale derived, so no boot may move it. Several reloads,
    // not one: a single repeat could be luck under a broken (random) selector — three
    // cannot.
    for (let i = 0; i < 3; i += 1) {
      await page.goto('/');
      await expect(quote(page)).toHaveText(first);
    }
  });

  test('per-load mode picks a fresh quote on each load', async ({ page }) => {
    await seed(page, { consentVersion: LEGAL_VERSION, quoteMode: 'per-load' });

    // The distinguishing property of per-load is that reloading *re-rolls* the pick.
    // Any single load looks exactly like daily mode, so the only assertion with teeth
    // is "reloads eventually disagree". A per-load mode silently behaving like daily
    // would have to keep re-rolling the same quote across all 10 loads.
    const seen = new Set<string>();
    for (let i = 0; i < 10 && seen.size < 2; i += 1) {
      await page.goto('/');
      const record = await currentRecord(page); // also proves the pick is a real pool record
      seen.add(record.id);
    }

    expect(
      seen.size,
      'per-load mode returned the same quote on 10 consecutive loads',
    ).toBeGreaterThan(1);
  });
});

test.describe('attribution', () => {
  test('renders each record’s exact attribution across one no-repeat pass', async ({ page }) => {
    // Pin New Year's Day so the pool narrows to the small, deterministic `new-year`
    // set. A random walk over the full ~190-quote pool can't reliably surface the
    // handful of linked records, and the anti-repeat ring (engine HISTORY_MAX = 50)
    // can't guarantee a no-repeat pass over a pool that large. The narrowed pool
    // sidesteps both while still exercising the linked AND plain branches.
    await page.clock.setFixedTime(new Date('2026-01-01T09:30:00+07:00'));
    await seed(page, { consentVersion: LEGAL_VERSION, quoteMode: 'daily' });
    await page.goto('/');
    await waitForInteractive(page);

    const nyPool = POOL.filter((q) => q.holidays.includes('new-year'));
    expect(nyPool.length, 'the new-year pool must have >1 quote to walk').toBeGreaterThan(1);

    const caption = page.locator('figcaption');
    const link = caption.getByRole('link');
    const seen = new Set<string>();
    let linked = 0;
    let plain = 0;

    // The pool is far below HISTORY_MAX, so the ring never re-picks: nyPool.length
    // `next` steps walk the whole (narrowed) pool exactly once.
    for (let i = 0; i < nyPool.length; i += 1) {
      const record = await currentRecord(page);
      expect(record.holidays.includes('new-year'), `${record.id} escaped the holiday filter`).toBe(
        true,
      );
      expect(seen.has(record.id), `anti-repeat re-showed ${record.id} within one pass`).toBe(false);
      seen.add(record.id);

      const { label, href } = expectedAttribution(record);
      await expect(caption).toHaveText(`— ${label}`);

      if (href === undefined) {
        // an unlinked record must not fabricate an anchor
        await expect(link).toHaveCount(0);
        plain += 1;
      } else {
        await expect(link).toHaveText(label);
        await expect(link).toHaveAttribute('href', href);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        linked += 1;
      }

      if (i < nyPool.length - 1) await clickToolbar(page, S.settings.next);
    }

    expect(seen.size, 'one pass did not surface the whole new-year pool').toBe(nyPool.length);
    // guard the two branches: if the data ever lost all links (or all plain records),
    // the loop would still be green while testing only half the renderer
    expect(linked, 'no record with an attribution link was exercised').toBeGreaterThan(0);
    expect(plain, 'no record without an attribution link was exercised').toBeGreaterThan(0);
  });
});
