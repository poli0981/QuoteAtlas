/**
 * Post-deploy smoke check against the live site (docs/12 §4).
 *
 * Everything here is decided by the *host*, not the bundle: `public/_headers` and
 * `wrangler.jsonc`'s `not_found_handling` have no effect under `vite preview`, so
 * the Playwright suite cannot see them — `e2e/csp.spec.ts` even has to replay the
 * headers by hand to test the CSP at all. That leaves a class of regression (a
 * dropped CSP, a soft 404 coming back, assets losing their immutable caching)
 * that would ship silently with every gate green. This is the check that fails.
 *
 * Every existence check asserts the CONTENT TYPE, never the status alone. Under
 * an SPA fallback a missing file answers `200` with the app shell, so a status
 * check passes for a file that is not there — which is exactly how the first
 * version of this script reported a green `/apple-touch-icon.png` while the
 * server was handing out `text/html`.
 *
 * Cloudflare caches at the edge, so a stale entry can outlive a deploy: a failure
 * here means "purge the cache, then re-run" at least as often as it means "the
 * build is wrong". `CF-Cache-Status: HIT` on a path you know changed is the tell.
 *
 * Run after a Workers build lands:  npm run smoke:web
 * Against a preview instead:        npm run smoke:web -- https://<preview-host>
 */
const BASE = (process.argv[2] ?? 'https://qouteatlas.app').replace(/\/$/, '');

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
}

async function head(path: string): Promise<Response> {
  // `redirect: 'manual'` so a 307 is visible rather than silently followed —
  // Cloudflare's html_handling rewrite is one of the things worth seeing.
  return fetch(`${BASE}${path}`, { redirect: 'manual' });
}

async function main(): Promise<void> {
  const root = await head('/');
  record('/ responds 200', root.status === 200, `status ${root.status}`);

  const csp = root.headers.get('content-security-policy') ?? '';
  record(
    '/ ships the CSP from public/_headers',
    csp.includes("default-src 'self'") && !csp.includes('unsafe-inline'),
    csp || '(absent)',
  );
  for (const h of ['x-content-type-options', 'referrer-policy', 'permissions-policy']) {
    record(`/ ships ${h}`, root.headers.get(h) != null, root.headers.get(h) ?? '(absent)');
  }
  record(
    '/ Permissions-Policy denies geolocation (R1)',
    (root.headers.get('permissions-policy') ?? '').includes('geolocation=()'),
    root.headers.get('permissions-policy') ?? '(absent)',
  );

  const html = await (await fetch(`${BASE}/`)).text();
  for (const [name, re] of [
    ['canonical', /<link rel="canonical" href="https:\/\/qouteatlas\.app\/"/],
    ['meta description', /<meta\s+name="description"/],
    ['og:title', /property="og:title"/],
    ['JSON-LD', /type="application\/ld\+json"/],
  ] as const) {
    record(`/ html carries ${name}`, re.test(html), re.test(html) ? 'present' : 'MISSING');
  }

  const robots = await head('/robots.txt');
  const robotsType = robots.headers.get('content-type') ?? '';
  record(
    '/robots.txt is served as text, not the app shell',
    robots.status === 200 && robotsType.includes('text/plain'),
    `status ${robots.status}, type ${robotsType || '(none)'}`,
  );

  const sitemap = await head('/sitemap.xml');
  const sitemapType = sitemap.headers.get('content-type') ?? '';
  record(
    '/sitemap.xml is served as XML, not the app shell',
    sitemap.status === 200 && sitemapType.includes('xml'),
    `status ${sitemap.status}, type ${sitemapType || '(none)'}`,
  );

  const missing = await head('/this-path-does-not-exist');
  record(
    'an unknown path returns a real 404, not a soft one',
    missing.status === 404,
    `status ${missing.status}`,
  );

  // The hashed bundle is the whole point of the immutable rule.
  const asset = /\/assets\/[A-Za-z0-9._-]+\.js/.exec(html)?.[0];
  if (asset == null) {
    record('found a hashed asset to check', false, 'no /assets/*.js in the served html');
  } else {
    const res = await head(asset);
    const cache = res.headers.get('cache-control') ?? '';
    record(`${asset} is cached immutably`, cache.includes('immutable'), cache || '(absent)');
  }

  for (const [path, type] of [
    ['/apple-touch-icon.png', 'image/png'],
    ['/icon-192.png', 'image/png'],
    ['/icon-512.png', 'image/png'],
    ['/icon-maskable-512.png', 'image/png'],
    ['/manifest.webmanifest', 'application/manifest+json'],
  ] as const) {
    const res = await head(path);
    const got = res.headers.get('content-type') ?? '';
    record(
      `${path} is served as ${type}`,
      res.status === 200 && got.includes(type),
      `status ${res.status}, type ${got || '(none)'}`,
    );
  }

  const width = Math.max(...checks.map((c) => c.name.length));
  for (const c of checks) {
    console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name.padEnd(width)}  ${c.detail}`);
  }

  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} passed against ${BASE}`);
  if (failed > 0) process.exitCode = 1;
}

await main();
