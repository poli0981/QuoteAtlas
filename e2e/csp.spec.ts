import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { LEGAL_VERSION, S, expect, openSettings, seed, test } from './fixtures';

/**
 * The shipped security headers (docs/09 §1) actually applied to the running app.
 *
 * `vite preview` does not read Cloudflare's `_headers`, so nothing else in the
 * suite — or in local dev — would ever notice that the CSP we ship breaks the app.
 * This spec parses the real file and replays those headers onto every response, so
 * a CSP that forbids something the app does fails CI instead of production.
 */
const HEADERS_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', '_headers');

/** Parse the `/*` block of the Cloudflare `_headers` file into real header pairs. */
function shippedHeaders(): Record<string, string> {
  const out: Record<string, string> = {};
  let inGlobalBlock = false;
  for (const line of readFileSync(HEADERS_FILE, 'utf8').split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      inGlobalBlock = line.trim() === '/*'; // a path line starts a new block
      continue;
    }
    if (!inGlobalBlock) continue;
    const at = line.indexOf(':');
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}

declare global {
  interface Window {
    __cspViolations: string[];
  }
}

/** Serve the app under the shipped headers and record every CSP violation it fires. */
async function underShippedHeaders(page: Page): Promise<void> {
  const headers = shippedHeaders();
  await page.route('**/*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(`${e.violatedDirective} blocked ${e.blockedURI}`);
    });
  });
  await seed(page, { consentVersion: LEGAL_VERSION });
  await page.goto('/');
}

const violations = (page: Page): Promise<string[]> => page.evaluate(() => window.__cspViolations);

test.describe('shipped security headers', () => {
  test('the _headers file really does forbid inline styles and scripts', () => {
    const csp = shippedHeaders()['Content-Security-Policy'] ?? '';
    // If this ever needs 'unsafe-inline', docs/09 §1 calls it a blocking review
    // item — so assert the strictness itself, not just that a CSP exists.
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    // R1: geolocation is banned in code *and* denied at the platform level.
    expect(shippedHeaders()['Permissions-Policy']).toContain('geolocation=()');
  });

  test('the CSP is genuinely enforced by the browser', async ({ page }) => {
    // Without this, "no violations" below would pass even if the header never
    // arrived. Injecting a <style> element is exactly what style-src 'self' blocks.
    await underShippedHeaders(page);
    await page.evaluate(() => {
      const el = document.createElement('style');
      el.textContent = 'body { outline: 1px solid red; }';
      document.head.appendChild(el);
    });
    await expect.poll(() => violations(page)).not.toHaveLength(0);
    expect((await violations(page)).join()).toContain('style-src');
  });

  test('the app boots and paints its background with zero CSP violations', async ({ page }) => {
    await underShippedHeaders(page);

    // the app renders: shell, quote, and the SW-registering bundle all loaded
    await expect(page.locator('blockquote')).not.toBeEmpty();
    // React writes dynamic styles through the CSSOM (element.style), which CSP does
    // not police — this is why style-src 'self' can stay strict. If React ever moved
    // to injected <style> tags or a style attribute, this is what would catch it.
    await expect(page.locator('main')).toHaveCSS('background-image', /linear-gradient/);

    expect(await violations(page)).toEqual([]);
  });

  test('changing the background at runtime stays within the CSP', async ({ page }) => {
    await underShippedHeaders(page);
    const panel = await openSettings(page);

    const color = panel
      .getByRole('group', { name: S.settings.background.mode })
      .getByRole('button', { name: S.settings.background.color, exact: true });
    await color.click();
    await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(10, 10, 10)');

    // the scrim + font colour are inline styles too, so a stricter CSP would break
    // the whole readability layer, not just the backdrop
    expect(await violations(page)).toEqual([]);
  });

  test('the host-level 404 page renders under the CSP, with its stylesheet applied', async ({
    page,
  }) => {
    await underShippedHeaders(page);
    await page.goto('/404.html');

    await expect(page.getByRole('heading', { name: S.errors.notFound.title })).toBeVisible();
    const home = page.getByRole('link');
    await expect(home).toHaveAttribute('href', '/');
    // an external stylesheet, because a <style> block would be blocked — prove it
    // actually applied rather than merely that the file 200'd
    await expect(page.locator('body')).toHaveCSS('background-image', /linear-gradient/);

    expect(await violations(page)).toEqual([]);
  });
});
