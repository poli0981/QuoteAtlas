import enData from '../data/quotes/en.json' with { type: 'json' };
import { S, expect, test } from './fixtures';

/**
 * Resilience (docs/06 §9, docs/08 §5): the offline notice, the offline-first PWA
 * precache, and the SPA fallback route.
 */

/**
 * Local helper (no shared fixture exists for this): the exact quote texts the app
 * can render. Asserting the visible quote is one of *these* proves the real bundled
 * pool rendered — an empty/stale shell served from a broken cache would not match.
 */
const POOL_TEXTS: string[] = (enData.quotes as { text: string }[]).map((q) => q.text);

test.describe('resilience', () => {
  test('surfaces the offline notice while disconnected and clears it on reconnect', async ({
    app,
  }) => {
    const notice = app.getByText(S.errors.offline.title);
    await expect(notice).toHaveCount(0);

    // real connectivity loss, no synthetic events: this must reach the app through
    // the browser's own online/offline events for the notice to appear at all.
    await app.context().setOffline(true);

    await expect(notice).toBeVisible();
    // offline is a *notice*, not an error state: the quote must stay on screen
    await expect(app.locator('blockquote')).toBeVisible();

    await app.context().setOffline(false);

    await expect(notice).toHaveCount(0);
    await expect(app.locator('blockquote')).toBeVisible();
  });

  test('reloads offline straight from the PWA precache', async ({ app, browserName }) => {
    test.skip(
      browserName !== 'chromium',
      'service-worker interception under an offline context is only reliable in chromium',
    );

    // registerType is 'prompt', so the first load merely *registers* the worker. It has
    // to reach the activated state before it can serve anything from the precache —
    // otherwise the reload below would simply hit the (dead) network.
    const scriptUrl = await app.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.active?.scriptURL ?? null;
    });
    expect(scriptUrl).toMatch(/\/sw\.js$/);

    await app.context().setOffline(true);
    await app.reload();

    // prove the reload really happened with no network, and that the document was served
    // by the service worker (controller != null) rather than from the plain HTTP cache
    expect(await app.evaluate(() => navigator.onLine)).toBe(false);
    expect(await app.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    // …and that the app shell itself is in a Cache Storage precache — that is what the
    // worker just replayed. Drop `html` from workbox.globPatterns and this fails.
    const shellIsPrecached = await app.evaluate(async () => {
      const names = await caches.keys();
      const cached = await Promise.all(
        names.map(async (name) => {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          return keys.some((req) => new URL(req.url).pathname === '/index.html');
        }),
      );
      return cached.includes(true);
    });
    expect(shellIsPrecached).toBe(true);

    // the *real* pool rendered from the precached bundle, not a blank shell
    const quote = app.locator('blockquote');
    await expect(quote).toBeVisible();
    expect(POOL_TEXTS).toContain(((await quote.textContent()) ?? '').trim());
    await expect(app.locator('figcaption')).not.toBeEmpty();
    // navigator.onLine is false at mount, so the banner comes up without any event
    await expect(app.getByText(S.errors.offline.title)).toBeVisible();
  });

  test('renders the notFound view on an unknown route, with a way back to the quotes', async ({
    app,
  }) => {
    await app.goto('/does-not-exist');

    await expect(app.getByRole('heading', { name: S.errors.notFound.title })).toBeVisible();
    await expect(app.getByText(S.errors.notFound.message)).toBeVisible();
    // the error page replaces the app shell entirely — no quote behind it
    await expect(app.locator('blockquote')).toHaveCount(0);

    // "back to quotes" is a <button> that assigns location, not an <a href>
    const home = app.getByRole('button', { name: S.errors.notFound.home });
    await expect(home).toBeVisible();
    await home.click();

    await expect(app).toHaveURL('/');
    await expect(app.locator('blockquote')).toBeVisible();
    await expect(app.getByRole('heading', { name: S.errors.notFound.title })).toHaveCount(0);
  });
});
