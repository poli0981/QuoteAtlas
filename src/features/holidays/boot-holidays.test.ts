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
