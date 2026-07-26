import { describe, expect, it } from 'vitest';
import { resolveActiveHolidays } from './boot-holidays';

describe('resolveActiveHolidays', () => {
  it('resolves Tết as a VN national holiday (lunar rule via amlich)', () => {
    // 17 Feb 2026 is Tết (lunar 1/1 of Bính Ngọ)
    const r = resolveActiveHolidays(new Date(2026, 1, 17), 'VN');
    expect(r.national).toContain('tet');
  });

  it('matches days within the multi-day Tết span', () => {
    expect(resolveActiveHolidays(new Date(2026, 1, 19), 'VN').national).toContain('tet');
  });

  it('resolves international new-year for any country', () => {
    expect(resolveActiveHolidays(new Date(2026, 0, 1), 'US').international).toContain('new-year');
    expect(resolveActiveHolidays(new Date(2026, 0, 1), 'JP').international).toContain('new-year');
  });

  it('returns empty on a non-holiday day', () => {
    expect(resolveActiveHolidays(new Date(2026, 6, 14), 'VN')).toEqual({
      national: [],
      international: [],
    });
  });

  it('returns empty when no region is known', () => {
    expect(resolveActiveHolidays(new Date(2026, 0, 1), null)).toEqual({
      national: [],
      international: [],
    });
  });
});

describe('resolveActiveHolidays — the tags the old grammar could never fire', () => {
  // Every tag below was present in tags.json and carried quotes, but no rule in
  // the M-D / lunar:M-D grammar could express its date, so it never once matched.
  const cases: [string, [number, number, number], string, 'national' | 'international'][] = [
    ['easter', [2026, 4, 5], 'US', 'international'],
    ['mothers-day', [2026, 5, 10], 'US', 'international'],
    ['fathers-day', [2026, 6, 21], 'US', 'international'],
    ['thanksgiving', [2026, 11, 26], 'US', 'international'],
    ['pancake-day', [2026, 2, 17], 'GB', 'national'],
    ['setsubun', [2026, 2, 3], 'JP', 'national'],
    ['qingming', [2026, 4, 5], 'CN', 'national'],
  ];

  for (const [tag, [y, m, d], country, level] of cases) {
    it(`fires ${tag} on ${String(d)}/${String(m)}/${String(y)} in ${country}`, () => {
      expect(resolveActiveHolidays(new Date(y, m - 1, d), country)[level]).toContain(tag);
    });

    it(`does not fire ${tag} the day before`, () => {
      expect(resolveActiveHolidays(new Date(y, m - 1, d - 1), country)[level]).not.toContain(tag);
    });
  }

  it('gives Britain its own Mothering Sunday instead of the international date', () => {
    // Easter − 21, not the 2nd Sunday of May. Without the shadowing in the merge,
    // a British user would get "mothers-day" on both days.
    expect(resolveActiveHolidays(new Date(2026, 2, 15), 'GB').international).toContain(
      'mothers-day',
    );
    expect(resolveActiveHolidays(new Date(2026, 4, 10), 'GB').international).not.toContain(
      'mothers-day',
    );
    // …while everyone else still gets the May date.
    expect(resolveActiveHolidays(new Date(2026, 4, 10), 'US').international).toContain(
      'mothers-day',
    );
  });

  it('resolves 春节 in China at UTC+8, not at Vietnam’s UTC+7', () => {
    // 2007 is one of the years R8 names: Tết is 17 Feb, 春节 is 18 Feb. Before the
    // zone became per-country, China got Vietnam's date.
    expect(resolveActiveHolidays(new Date(2007, 1, 18), 'CN').national).toContain('chunjie');
    expect(resolveActiveHolidays(new Date(2007, 1, 17), 'CN').national).not.toContain('chunjie');
    expect(resolveActiveHolidays(new Date(2007, 1, 17), 'VN').national).toContain('tet');
  });
});
