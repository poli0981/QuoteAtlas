import { describe, expect, it } from 'vitest';
import { holidayFilter, resolve, resolveRuleDate } from './resolver';
import type { HolidayOverride, HolidayTagRegistry } from './types';
import type { QuoteRecord } from '../quote/types';

const registry: HolidayTagRegistry = {
  tet: { scope: 'national', countries: ['VN'] },
  'hung-kings': { scope: 'national', countries: ['VN'] },
  'new-year': { scope: 'international' },
  'mid-autumn': { scope: 'national', countries: ['VN', 'CN', 'TW', 'HK', 'KR'] },
};

const vnOverrides: HolidayOverride = {
  country: 'VN',
  add: [
    { tag: 'tet', rule: 'lunar:1-1', days: 5 },
    { tag: 'hung-kings', rule: 'lunar:3-10' },
    { tag: 'new-year', rule: '1-1' },
  ],
};

function q(id: string, holidays: string[]): QuoteRecord {
  return {
    id,
    type: 'proverb',
    text: id,
    lang: 'vi',
    translations: {},
    attribution: {
      work: null,
      character: null,
      actor: null,
      author: null,
      developer: null,
      publisher: null,
      source: 'x',
      year: null,
      links: {},
      rights: 'public-domain',
    },
    regions: ['VN'],
    tags: [],
    holidays,
  };
}

describe('resolveRuleDate', () => {
  it('resolves a fixed Gregorian rule', () => {
    expect(resolveRuleDate('12-25', 2026)).toEqual({ m: 12, d: 25 });
  });

  it('resolves a lunar rule via amlich (Tết 2026 = 17 Feb)', () => {
    expect(resolveRuleDate('lunar:1-1', 2026)).toEqual({ m: 2, d: 17 });
  });

  it('returns null for malformed rules', () => {
    expect(resolveRuleDate('nonsense', 2026)).toBeNull();
    expect(resolveRuleDate('lunar:x-y', 2026)).toBeNull();
  });
});

describe('resolve', () => {
  it('matches Tết day 1 as a national holiday (VN)', () => {
    expect(resolve({ d: 17, m: 2, y: 2026 }, 'VN', registry, vnOverrides)).toEqual({
      national: ['tet'],
      international: [],
    });
  });

  it('matches a Tết day within the multi-day span (day 3)', () => {
    const r = resolve({ d: 19, m: 2, y: 2026 }, 'VN', registry, vnOverrides);
    expect(r.national).toContain('tet');
  });

  it('does not match the day after the span ends', () => {
    const r = resolve({ d: 22, m: 2, y: 2026 }, 'VN', registry, vnOverrides);
    expect(r.national).not.toContain('tet');
  });

  it('classifies a fixed international holiday (new-year)', () => {
    expect(resolve({ d: 1, m: 1, y: 2026 }, 'VN', registry, vnOverrides)).toEqual({
      national: [],
      international: ['new-year'],
    });
  });

  it('honors override removal', () => {
    const removed: HolidayOverride = { ...vnOverrides, remove: ['tet'] };
    const r = resolve({ d: 17, m: 2, y: 2026 }, 'VN', registry, removed);
    expect(r.national).not.toContain('tet');
  });

  it('drops national tags for a non-matching country', () => {
    const r = resolve({ d: 17, m: 2, y: 2026 }, 'JP', registry, { ...vnOverrides, country: 'JP' });
    expect(r.national).toEqual([]);
  });
});

describe('holidayFilter — precedence (docs/05 §4)', () => {
  const pool = [q('a', ['tet']), q('b', ['new-year']), q('c', []), q('d', ['tet', 'new-year'])];

  it('national wins over international', () => {
    const out = holidayFilter(pool, { national: ['tet'], international: ['new-year'] });
    expect(out.map((r) => r.id).sort()).toEqual(['a', 'd']);
  });

  it('falls back to international when no national match', () => {
    const out = holidayFilter(pool, { national: ['nope'], international: ['new-year'] });
    expect(out.map((r) => r.id).sort()).toEqual(['b', 'd']);
  });

  it('returns the full pool when nothing matches (never blanks)', () => {
    const out = holidayFilter(pool, { national: ['nope'], international: ['nada'] });
    expect(out).toHaveLength(pool.length);
  });

  it('returns the full pool when there are no holiday tags', () => {
    expect(holidayFilter(pool, { national: [], international: [] })).toHaveLength(pool.length);
  });
});
