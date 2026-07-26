import { describe, expect, it } from 'vitest';
import { easterDate, lastWeekday, lunarZoneFor, nthWeekday, resolveRule } from './rules';

/** `MM-DD`, so an expectation reads like a date instead of an object. */
const at = (r: { m: number; d: number } | null): string =>
  r == null ? 'null' : `${String(r.m).padStart(2, '0')}-${String(r.d).padStart(2, '0')}`;

const on = (rule: string, year: number, zone = 7): string => at(resolveRule(rule, year, zone));

describe('easterDate — Gregorian computus', () => {
  it('matches the published dates', () => {
    // Western Easter; Orthodox uses the Julian computus and is not modelled.
    expect(at(easterDate(2024))).toBe('03-31');
    expect(at(easterDate(2025))).toBe('04-20');
    expect(at(easterDate(2026))).toBe('04-05');
    expect(at(easterDate(2027))).toBe('03-28');
    expect(at(easterDate(2038))).toBe('04-25'); // latest possible
    expect(at(easterDate(2285))).toBe('03-22'); // earliest possible
  });

  it('never falls outside 22 March – 25 April, in any year of the range', () => {
    for (let y = 1900; y <= 2100; y++) {
      const e = easterDate(y);
      const ok = (e.m === 3 && e.d >= 22) || (e.m === 4 && e.d <= 25);
      expect(ok, `Easter ${String(y)} = ${at(e)}`).toBe(true);
    }
  });

  it('always lands on a Sunday', () => {
    for (let y = 1900; y <= 2100; y++) {
      const e = easterDate(y);
      expect(new Date(Date.UTC(y, e.m - 1, e.d)).getUTCDay(), `Easter ${String(y)}`).toBe(0);
    }
  });
});

describe('nthWeekday / lastWeekday', () => {
  it('finds the nth weekday of a month', () => {
    // 2nd Sunday of May 2025 = Mother's Day
    expect(at(nthWeekday(2025, 5, 0, 2))).toBe('05-11');
    // 4th Thursday of November 2025 = US Thanksgiving
    expect(at(nthWeekday(2025, 11, 4, 4))).toBe('11-27');
    // 1st of a weekday that IS the 1st of the month
    expect(at(nthWeekday(2025, 12, 1, 1))).toBe('12-01');
  });

  it('returns null when the month has no nth occurrence', () => {
    // February 2025 starts on a Saturday: four Saturdays, no fifth.
    expect(nthWeekday(2025, 2, 6, 5)).toBeNull();
    expect(nthWeekday(2025, 5, 0, 0)).toBeNull();
    expect(nthWeekday(2025, 5, 0, -1)).toBeNull();
  });

  it('finds a 5th occurrence when the month really has one', () => {
    // May 2025 has five Saturdays: 3, 10, 17, 24, 31.
    expect(at(nthWeekday(2025, 5, 6, 5))).toBe('05-31');
  });

  it('finds the last weekday, including in a leap February', () => {
    expect(at(lastWeekday(2025, 5, 1))).toBe('05-26'); // US Memorial Day
    expect(at(lastWeekday(2024, 2, 4))).toBe('02-29'); // leap day is a Thursday
    expect(at(lastWeekday(2025, 12, 3))).toBe('12-31');
  });
});

describe('resolveRule — fixed and lunisolar', () => {
  it('resolves a fixed Gregorian date unchanged', () => {
    expect(on('12-25', 2026)).toBe('12-25');
    expect(on('1-1', 2026)).toBe('01-01');
  });

  it('resolves a lunisolar date in the zone it is given', () => {
    // The whole point of the zone parameter: Tết and 春节 are a day apart in the
    // years R8 names, so resolving China's at Vietnam's UTC+7 would be wrong.
    expect(on('lunar:1-1', 2007, 7)).toBe('02-17'); // VN
    expect(on('lunar:1-1', 2007, 8)).toBe('02-18'); // CN
    expect(on('lunar:1-1', 1968, 7)).toBe('01-29');
    expect(on('lunar:1-1', 1968, 8)).toBe('01-30');
  });

  it('agrees on a year with no divergence', () => {
    expect(on('lunar:1-1', 2026, 7)).toBe(on('lunar:1-1', 2026, 8));
  });
});

describe('resolveRule — weekday rules', () => {
  it('resolves nth: and last: through the grammar', () => {
    expect(on('nth:5-0-2', 2025)).toBe('05-11'); // Mother's Day
    expect(on('nth:11-4-4', 2025)).toBe('11-27'); // US Thanksgiving
    expect(on('last:5-1', 2025)).toBe('05-26'); // US Memorial Day
    expect(on('last:8-1', 2025)).toBe('08-25'); // UK summer bank holiday
  });

  it('returns null when the nth occurrence does not exist', () => {
    expect(resolveRule('nth:2-6-5', 2025, 7)).toBeNull();
  });
});

describe('resolveRule — Easter-relative', () => {
  it('resolves Easter itself and offsets from it', () => {
    expect(on('easter', 2025)).toBe('04-20');
    // Shrove Tuesday / pancake day is Easter − 47, which crosses a month edge
    expect(on('easter-47', 2025)).toBe('03-04');
    expect(on('easter-47', 2024)).toBe('02-13');
    // Mothering Sunday (GB) is Easter − 21, nothing like the 2nd Sunday of May
    expect(on('easter-21', 2025)).toBe('03-30');
    expect(on('easter+49', 2025)).toBe('06-08'); // Pentecost
  });

  it('rolls an offset across the year boundary', () => {
    // Not a real holiday — proves the shift is date arithmetic, not month maths.
    expect(on('easter-100', 2025)).toBe('01-10');
  });
});

describe('resolveRule — solar terms', () => {
  it('resolves the terms the data uses', () => {
    expect(on('term:qingming', 2024, 8)).toBe('04-04');
    expect(on('term:qingming', 2026, 8)).toBe('04-05');
    // Setsubun is the day BEFORE lập xuân. In 2025 lập xuân fell on 3 Feb — the
    // first time in 124 years — so setsubun was 2 Feb, not the usual 3rd.
    expect(on('term:lichun-1', 2025, 9)).toBe('02-02');
    expect(on('term:lichun-1', 2024, 9)).toBe('02-03');
    expect(on('term:lichun-1', 2026, 9)).toBe('02-03');
  });

  it('places the solstices and equinoxes on their known days', () => {
    expect(on('term:dongzhi', 2024, 7)).toBe('12-21');
    expect(on('term:dongzhi', 2026, 7)).toBe('12-22');
    expect(on('term:chunfen', 2025, 8)).toBe('03-20');
    expect(on('term:xiazhi', 2025, 8)).toBe('06-21');
    expect(on('term:qiufen', 2025, 8)).toBe('09-23');
  });

  it('rejects a term it does not know', () => {
    // A typo must fail loudly at the schema and silently-but-safely here, never
    // resolve to some arbitrary day.
    expect(resolveRule('term:notaterm', 2025, 8)).toBeNull();
    expect(resolveRule('term:', 2025, 8)).toBeNull();
  });
});

describe('resolveRule — malformed input', () => {
  it('returns null rather than a wrong date', () => {
    for (const rule of [
      '',
      'nonsense',
      '12',
      '12-25-1',
      'lunar:1',
      'lunar:a-b',
      'nth:5-0',
      'nth:5-9-2', // weekday out of range
      'nth:13-0-2', // month out of range
      'last:5',
      'last:5-9',
      'last:13-1',
      'easterish',
      'easter+x',
      'term:qingming+x',
    ]) {
      expect(resolveRule(rule, 2025, 7), rule).toBeNull();
    }
  });

  it('rejects an out-of-range month or day rather than inventing a date', () => {
    // convertLunar2Solar derives an offset from month 11 and never asks whether
    // the month exists, so `lunar:13-1` used to resolve to a real-looking date.
    // The schema pattern cannot catch this either — it only constrains digits.
    for (const rule of ['lunar:13-1', 'lunar:0-1', 'lunar:1-31', 'lunar:1-0']) {
      expect(resolveRule(rule, 2025, 7), rule).toBeNull();
    }
    for (const rule of ['13-1', '0-1', '12-32', '12-0']) {
      expect(resolveRule(rule, 2025, 7), rule).toBeNull();
    }
  });

  it('still accepts the extremes that are valid', () => {
    expect(on('12-31', 2025)).toBe('12-31');
    expect(on('lunar:12-30', 2025)).not.toBe('null');
  });
});

describe('lunarZoneFor', () => {
  it('gives each region the zone its calendar is actually reckoned in', () => {
    expect(lunarZoneFor('VN')).toBe(7);
    for (const c of ['CN', 'TW', 'HK', 'MO', 'SG', 'MY']) expect(lunarZoneFor(c), c).toBe(8);
    expect(lunarZoneFor('KR')).toBe(9);
    expect(lunarZoneFor('JP')).toBe(9);
  });

  it('is case-insensitive and defaults to UTC+7', () => {
    expect(lunarZoneFor('cn')).toBe(8);
    // A country with no lunisolar holidays never reaches a lunar rule, so the
    // default only has to be a sane one.
    expect(lunarZoneFor('US')).toBe(7);
  });
});
