import { describe, expect, it } from 'vitest';
import { buildIssueUrl, buildReportText, collectContext, deriveOs, formatLogs } from './report';
import type { LogEntry } from '../../lib/log-buffer';

describe('deriveOs', () => {
  it('classifies common user agents', () => {
    expect(deriveOs('Mozilla/5.0 (Windows NT 10.0)')).toBe('Windows');
    expect(deriveOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)')).toBe('macOS');
    expect(deriveOs('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux');
    expect(deriveOs('Mozilla/5.0 (Linux; Android 14)')).toBe('Android');
    expect(deriveOs('Mozilla/5.0 (iPhone)')).toBe('iOS');
    expect(deriveOs('something else')).toBe('unknown');
  });
});

describe('collectContext', () => {
  it('assembles context and defaults a null region to "auto"', () => {
    const ctx = collectContext({
      appVersion: '1.2.3',
      platform: 'web',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
      locale: 'vi',
      region: null,
    });
    expect(ctx).toEqual({
      appVersion: '1.2.3',
      platform: 'web',
      os: 'Windows',
      locale: 'vi',
      region: 'auto',
    });
  });
});

describe('formatLogs', () => {
  it('formats + redacts entries', () => {
    const entries: LogEntry[] = [
      {
        t: Date.UTC(2026, 6, 14),
        level: 'error',
        code: 'E_CRASH',
        msg: 'boom at C:\\Users\\Anon\\x',
      },
      { t: Date.UTC(2026, 6, 14), level: 'warn', msg: 'ping k30021424@gmail.com' },
    ];
    const out = formatLogs(entries);
    expect(out).toContain('error E_CRASH: boom at ~\\x');
    expect(out).toContain('warn: ping <email>');
  });

  it('returns empty string for no entries', () => {
    expect(formatLogs([])).toBe('');
  });
});

describe('buildReportText', () => {
  it('includes context and logs', () => {
    const ctx = collectContext({
      appVersion: '0.0.0',
      platform: 'web',
      userAgent: 'x',
      locale: 'en',
      region: 'VN',
    });
    const text = buildReportText(ctx, 'line1');
    expect(text).toContain('App: QuoteAtlas 0.0.0');
    expect(text).toContain('Region: VN');
    expect(text).toContain('line1');
  });

  it('notes when there are no logs', () => {
    const ctx = collectContext({
      appVersion: '0',
      platform: 'web',
      userAgent: 'x',
      locale: 'en',
      region: 'US',
    });
    expect(buildReportText(ctx, '')).toContain('(no log entries)');
  });
});

describe('buildIssueUrl', () => {
  const ctx = collectContext({
    appVersion: '0.0.0',
    platform: 'web',
    userAgent: 'x',
    locale: 'en',
    region: 'US',
  });

  it('builds a prefilled new-issue URL', () => {
    const url = buildIssueUrl(ctx, 'short logs');
    expect(url).not.toBeNull();
    expect(url).toContain('github.com/poli0981/QuoteAtlas/issues/new');
    expect(url).toContain('body=');
  });

  it('returns null when the URL would exceed the cap', () => {
    expect(buildIssueUrl(ctx, 'x'.repeat(8000))).toBeNull();
  });
});
