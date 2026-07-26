import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { S, expect, test } from './fixtures';

/**
 * The crawler-facing surface (docs/08 §5).
 *
 * Nothing else in the suite looks at `<head>`, so a dropped canonical, a broken
 * icon reference or a `robots.txt` that stops being served as a file would fail
 * silently in production. Where the *host* is what would lie — content types, the
 * real 404 status, cache headers — this asserts the built artifact instead:
 * `vite preview` is not Cloudflare, and asserting its responses would be testing
 * the wrong server. Those checks live in `npm run smoke:web`.
 */
const ORIGIN = 'https://qouteatlas.app';
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

function content(page: Page, selector: string): Promise<string | null> {
  return page.locator(selector).getAttribute('content');
}

test.describe('crawler-facing surface', () => {
  test('robots.txt ships as a real file and points at the sitemap', () => {
    const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(new RegExp(`^Sitemap: ${ORIGIN}/sitemap\\.xml$`, 'm'));
    // A disallowed bundle would leave a crawler rendering an empty shell.
    expect(robots).not.toMatch(/^Disallow: \/assets/m);
  });

  test('the sitemap lists exactly the one route the app actually has', () => {
    const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([`${ORIGIN}/`]);
  });

  test('the head carries title, description, canonical and icons', async ({ app }) => {
    await expect(app).toHaveTitle(/QuoteAtlas/);

    const description = await content(app, 'meta[name="description"]');
    expect(description).toBeTruthy();
    // Google truncates well before this; longer is a copy bug, not a hard failure.
    expect(description?.length ?? 0).toBeLessThanOrEqual(160);

    await expect(app.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}/`);
    expect(await content(app, 'meta[name="theme-color"]')).toBe('#0f172a');
    await expect(app.locator('link[rel="icon"]')).toHaveAttribute('href', '/icon.svg');
    await expect(app.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      '/apple-touch-icon.png',
    );
  });

  test('social cards have a title, description, absolute url and image', async ({ app }) => {
    expect(await content(app, 'meta[property="og:title"]')).toBeTruthy();
    expect(await content(app, 'meta[property="og:description"]')).toBeTruthy();
    // Relative URLs are silently dropped by most scrapers.
    expect(await content(app, 'meta[property="og:url"]')).toBe(`${ORIGIN}/`);
    expect(await content(app, 'meta[property="og:image"]')).toMatch(new RegExp(`^${ORIGIN}/`));
    expect(await content(app, 'meta[name="twitter:card"]')).toBeTruthy();
  });

  test('the JSON-LD block is valid JSON and survives the bundler', async ({ app }) => {
    const raw = await app.locator('script[type="application/ld+json"]').textContent();
    const ld = JSON.parse(raw ?? '') as Record<string, unknown>;
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('WebApplication');
    expect(ld.url).toBe(`${ORIGIN}/`);
  });

  test('every icon the manifest promises is actually served', async ({ app, request }) => {
    const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
      icons: { src: string; purpose: string }[];
    };

    // Android's install prompt needs a raster; the SVG alone does not satisfy it.
    expect(manifest.icons.some((i) => i.src.endsWith('.png'))).toBe(true);
    expect(manifest.icons.some((i) => i.purpose.includes('maskable'))).toBe(true);

    for (const icon of manifest.icons) {
      const res = await request.get(`/${icon.src.replace(/^\//, '')}`);
      expect(res.status(), `${icon.src} must be served`).toBe(200);
    }
    // The fixture is only here for the booted page; keep the linter honest.
    await expect(app.locator('blockquote')).not.toBeEmpty();
  });

  test('the document language follows the chosen UI language', async ({ app }) => {
    // index.html can only ship a static lang; the UI language is a stored setting.
    await expect(app.locator('html')).toHaveAttribute('lang', 'en');

    await app.getByRole('button', { name: S.common.language.vi, exact: true }).click();

    await expect(app.locator('html')).toHaveAttribute('lang', 'vi');
  });
});
