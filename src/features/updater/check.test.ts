import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdate, excerpt, isNewer } from './check';

function mockRes(opts: { status: number; headers?: Record<string, string>; body?: unknown }) {
  const headers = opts.headers ?? {};
  return {
    status: opts.status,
    ok: opts.status >= 200 && opts.status < 300,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null },
    json: () => Promise.resolve(opts.body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isNewer', () => {
  it('compares semver components numerically', () => {
    expect(isNewer('1.2.0', '1.1.9')).toBe(true);
    expect(isNewer('2.0.0', '1.9.9')).toBe(true);
    expect(isNewer('1.0.10', '1.0.9')).toBe(true);
    expect(isNewer('1.0.0', '1.0.0')).toBe(false);
    expect(isNewer('1.0.0', '1.0.1')).toBe(false);
  });

  it('tolerates a leading v and pre-release suffix', () => {
    expect(isNewer('v1.2.0', '1.1.0')).toBe(true);
    expect(isNewer('1.2.0-beta.1', '1.2.0')).toBe(false);
  });
});

describe('excerpt', () => {
  it('returns short text unchanged', () => {
    expect(excerpt('hello')).toBe('hello');
  });
  it('truncates long text with an ellipsis', () => {
    const out = excerpt('a'.repeat(600), 500);
    expect(out.length).toBeLessThanOrEqual(501);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('checkForUpdate', () => {
  it('maps 304 to up-to-date', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes({ status: 304 })));
    expect(await checkForUpdate('0.1.0', '"etag"')).toEqual({ kind: 'up-to-date' });
  });

  it('maps 404 to E_UPDATE_NO_RELEASE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes({ status: 404 })));
    expect(await checkForUpdate('0.1.0', null)).toEqual({
      kind: 'error',
      code: 'E_UPDATE_NO_RELEASE',
    });
  });

  it('maps 429 and rate-limited 403 to E_UPDATE_RATELIMIT', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes({ status: 429 })));
    expect((await checkForUpdate('0.1.0', null)).kind).toBe('error');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(mockRes({ status: 403, headers: { 'x-ratelimit-remaining': '0' } })),
    );
    expect(await checkForUpdate('0.1.0', null)).toEqual({
      kind: 'error',
      code: 'E_UPDATE_RATELIMIT',
    });
  });

  it('maps 5xx to E_UPDATE_SERVER', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes({ status: 503 })));
    expect(await checkForUpdate('0.1.0', null)).toEqual({ kind: 'error', code: 'E_UPDATE_SERVER' });
  });

  it('returns available when the release tag is newer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockRes({
          status: 200,
          headers: { etag: '"new"' },
          body: { tag_name: 'v9.9.9', body: 'Notes here', html_url: 'https://example.test/r' },
        }),
      ),
    );
    const result = await checkForUpdate('0.1.0', null);
    expect(result).toEqual({
      kind: 'available',
      info: { version: '9.9.9', notes: 'Notes here', url: 'https://example.test/r', etag: '"new"' },
    });
  });

  it('returns up-to-date when the release tag is not newer', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          mockRes({ status: 200, body: { tag_name: 'v0.1.0', html_url: 'https://x.test' } }),
        ),
    );
    expect(await checkForUpdate('0.1.0', null)).toEqual({ kind: 'up-to-date' });
  });

  it('treats a missing tag/url as no release', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockRes({ status: 200, body: { foo: 'bar' } })),
    );
    expect(await checkForUpdate('0.1.0', null)).toEqual({
      kind: 'error',
      code: 'E_UPDATE_NO_RELEASE',
    });
  });

  it('maps a network failure to E_UPDATE_OFFLINE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await checkForUpdate('0.1.0', null)).toEqual({
      kind: 'error',
      code: 'E_UPDATE_OFFLINE',
    });
  });
});
