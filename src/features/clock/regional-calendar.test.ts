import { describe, expect, it } from 'vitest';
import { calendarFor } from './regional-calendar';

describe('calendarFor — the docs/07 §4 table', () => {
  it('gives Vietnam the in-house calendar, never Intl chinese (R8)', () => {
    // The whole reason amlich.ts exists: `chinese` computes at UTC+8 and puts
    // Tết 1985 a month away from the Vietnamese date.
    expect(calendarFor('VN')).toEqual({ kind: 'vn' });
  });

  it('maps the Chinese-calendar regions', () => {
    for (const r of ['CN', 'TW', 'HK', 'MO', 'SG', 'MY']) {
      expect(calendarFor(r), r).toEqual({ kind: 'intl', calendar: 'chinese' });
    }
  });

  it('maps the single-region calendars', () => {
    expect(calendarFor('JP')).toEqual({ kind: 'intl', calendar: 'japanese', era: true });
    expect(calendarFor('KR')).toEqual({ kind: 'intl', calendar: 'dangi' });
    expect(calendarFor('TH')).toEqual({ kind: 'intl', calendar: 'buddhist', era: true });
    expect(calendarFor('IL')).toEqual({ kind: 'intl', calendar: 'hebrew' });
    expect(calendarFor('IR')).toEqual({ kind: 'intl', calendar: 'persian' });
    expect(calendarFor('AF')).toEqual({ kind: 'intl', calendar: 'persian' });
  });

  it('maps the Hijri regions', () => {
    for (const r of ['SA', 'AE', 'EG', 'QA', 'MA']) {
      expect(calendarFor(r), r).toEqual({ kind: 'intl', calendar: 'islamic-umalqura' });
    }
  });

  it('hides the line for a region with no second calendar', () => {
    // Showing a Gregorian date twice would be worse than showing one.
    for (const r of ['US', 'GB', 'DE', 'BR', 'ZZ']) {
      expect(calendarFor(r), r).toBeNull();
    }
  });

  it('hides the line when the region is unknown', () => {
    expect(calendarFor(null)).toBeNull();
    expect(calendarFor(undefined)).toBeNull();
  });

  it('accepts a lowercase region code', () => {
    // detect() and the picker both emit uppercase, but a persisted override from
    // an older build must not silently lose the line.
    expect(calendarFor('vn')).toEqual({ kind: 'vn' });
    expect(calendarFor('jp')).toEqual({ kind: 'intl', calendar: 'japanese', era: true });
  });
});

describe('calendarFor — every mapped calendar actually renders', () => {
  it('produces a non-empty string through Intl for each mapped calendar', () => {
    // Guards against a typo'd `-u-ca-` key, which Intl silently ignores by
    // falling back to Gregorian rather than throwing.
    const now = new Date('2026-07-26T12:00:00Z');
    const seen = new Set<string>();
    for (const r of ['CN', 'JP', 'KR', 'TH', 'SA', 'IL', 'IR']) {
      const cal = calendarFor(r);
      expect(cal?.kind).toBe('intl');
      if (cal?.kind !== 'intl') continue;
      const out = new Intl.DateTimeFormat(`en-u-ca-${cal.calendar}`, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now);
      expect(out.length, `${r} → ${cal.calendar}`).toBeGreaterThan(0);
      seen.add(out);
    }
    // A silently-ignored calendar key would render Gregorian for all of them.
    expect(seen.size).toBeGreaterThan(3);
  });
});
