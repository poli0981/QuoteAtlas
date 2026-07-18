/**
 * Android in-app update check (docs/03 §5, docs/08 §4). The ONLY network module —
 * `fetch` is lint-allowed here and nowhere else (R1). It queries the GitHub
 * Releases API (ETag-cached, 10s timeout) and returns whether a newer version
 * exists; it never downloads or installs anything (the UI opens the release page
 * in the browser). Desktop has no updater this round, so this is Android-only.
 */
import type { QaErrorCode } from '../../lib/qa-error';

const RELEASES_LATEST = 'https://api.github.com/repos/poli0981/QuoteAtlas/releases/latest';
const TIMEOUT_MS = 10_000;
const NOTES_MAX = 500;

export type UpdateErrorCode = Extract<
  QaErrorCode,
  'E_UPDATE_OFFLINE' | 'E_UPDATE_RATELIMIT' | 'E_UPDATE_NO_RELEASE' | 'E_UPDATE_SERVER'
>;

export interface UpdateInfo {
  version: string;
  notes: string;
  url: string;
  etag: string | null;
}

export type UpdateResult =
  | { kind: 'up-to-date' }
  | { kind: 'available'; info: UpdateInfo }
  | { kind: 'error'; code: UpdateErrorCode };

/** SemVer-ish compare (major.minor.patch, pre-release/build ignored). */
export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string): number[] =>
    (v.replace(/^v/, '').split('-')[0] ?? '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/** Trim release notes to a dialog-sized excerpt. */
export function excerpt(body: string, max = NOTES_MAX): string {
  const trimmed = body.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max).trimEnd()}…`;
}

export async function checkForUpdate(
  currentVersion: string,
  etag: string | null,
): Promise<UpdateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);
  try {
    const res = await fetch(RELEASES_LATEST, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(etag ? { 'If-None-Match': etag } : {}),
      },
      signal: controller.signal,
    });

    if (res.status === 304) return { kind: 'up-to-date' };
    if (res.status === 404) return { kind: 'error', code: 'E_UPDATE_NO_RELEASE' };
    if (res.status === 429) return { kind: 'error', code: 'E_UPDATE_RATELIMIT' };
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      return { kind: 'error', code: 'E_UPDATE_RATELIMIT' };
    }
    if (res.status >= 500) return { kind: 'error', code: 'E_UPDATE_SERVER' };
    if (!res.ok) return { kind: 'error', code: 'E_UPDATE_SERVER' };

    const raw: unknown = await res.json();
    const rel = raw as { tag_name?: unknown; body?: unknown; html_url?: unknown };
    const tag = typeof rel.tag_name === 'string' ? rel.tag_name : '';
    const url = typeof rel.html_url === 'string' ? rel.html_url : '';
    if (!tag || !url) return { kind: 'error', code: 'E_UPDATE_NO_RELEASE' };

    const latest = tag.replace(/^v/, '');
    if (!isNewer(latest, currentVersion)) return { kind: 'up-to-date' };

    return {
      kind: 'available',
      info: {
        version: latest,
        notes: excerpt(typeof rel.body === 'string' ? rel.body : ''),
        url,
        etag: res.headers.get('etag'),
      },
    };
  } catch {
    // Network failure, DNS, or the 10s abort all read as "offline" to the user.
    return { kind: 'error', code: 'E_UPDATE_OFFLINE' };
  } finally {
    clearTimeout(timer);
  }
}
