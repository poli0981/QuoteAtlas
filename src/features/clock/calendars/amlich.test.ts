import { describe, expect, it } from 'vitest';
import {
  canChiYear,
  convertLunar2Solar,
  convertSolar2Lunar,
  formatVi,
  type LunarDate,
} from './amlich';
import vectors from './fixtures/amlich-vectors.json';
import { mulberry32 } from '../../../lib/prng';

describe('amlich — Tết anchors', () => {
  for (const t of vectors.tet) {
    it(`Tết ${String(t.solar.y)}: ${t.canChi}`, () => {
      expect(convertSolar2Lunar(t.solar.d, t.solar.m, t.solar.y)).toEqual(t.lunar);
      expect(convertLunar2Solar(t.lunar.day, t.lunar.month, t.lunar.year, t.lunar.leap)).toEqual(
        t.solar,
      );
      expect(canChiYear(t.lunar.year)).toBe(t.canChi);
    });
  }
});

describe('amlich — VN/CN divergence (R8)', () => {
  for (const d of vectors.divergence) {
    it(`${d.solar.d}/${d.solar.m}/${d.solar.y} is Vietnamese lunar new year`, () => {
      expect(convertSolar2Lunar(d.solar.d, d.solar.m, d.solar.y)).toEqual(d.lunar);
    });
  }
});

describe('amlich — leap month detection', () => {
  function leapMonthsInSolarYear(year: number): Set<number> {
    const leaps = new Set<number>();
    for (let m = 1; m <= 12; m++) {
      const days = new Date(year, m, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const l = convertSolar2Lunar(d, m, year);
        if (l.leap) leaps.add(l.month);
      }
    }
    return leaps;
  }

  for (const ly of vectors.leapYears) {
    it(`solar year ${String(ly.year)} contains leap month ${String(ly.leapMonth)}`, () => {
      expect([...leapMonthsInSolarYear(ly.year)]).toEqual([ly.leapMonth]);
    });
  }

  it('a non-leap year (2024) has no leap month', () => {
    expect(leapMonthsInSolarYear(2024).size).toBe(0);
  });
});

describe('amlich — round-trip property (5000 random dates, 1900–2100)', () => {
  it('convertLunar2Solar(convertSolar2Lunar(d)) === d', () => {
    const rng = mulberry32(0x51ac);
    const startJd = Date.UTC(1900, 0, 1);
    const endJd = Date.UTC(2100, 11, 31);
    const span = (endJd - startJd) / 86400000;
    let checked = 0;
    for (let i = 0; i < 5000; i++) {
      const date = new Date(startJd + Math.floor(rng() * span) * 86400000);
      const d = date.getUTCDate();
      const m = date.getUTCMonth() + 1;
      const y = date.getUTCFullYear();
      const lunar: LunarDate = convertSolar2Lunar(d, m, y);
      const back = convertLunar2Solar(lunar.day, lunar.month, lunar.year, lunar.leap);
      expect(back, `round-trip failed for ${d}/${m}/${y}`).toEqual({ d, m, y });
      checked++;
    }
    expect(checked).toBe(5000);
  });
});

describe('amlich — can-chi & formatting', () => {
  it('computes can-chi years correctly', () => {
    expect(canChiYear(2020)).toBe('Canh Tý');
    expect(canChiYear(2024)).toBe('Giáp Thìn');
    expect(canChiYear(2026)).toBe('Bính Ngọ');
  });

  it('formats a Vietnamese lunar label (docs/07 §4)', () => {
    expect(formatVi({ day: 22, month: 5, year: 2026, leap: false })).toBe(
      'ngày 22 tháng Năm, Bính Ngọ',
    );
    expect(formatVi({ day: 1, month: 6, year: 2025, leap: true })).toBe(
      'ngày 1 tháng Sáu (nhuận), Ất Tỵ',
    );
  });
});

describe('amlich — historical & edge branches', () => {
  it('handles pre-Gregorian (Julian, < 1582) dates without throwing', () => {
    const l = convertSolar2Lunar(1, 1, 1500); // exercises the Julian jdFromDate branch
    expect(l.month).toBeGreaterThanOrEqual(1);
    expect(l.month).toBeLessThanOrEqual(12);
    const s = convertLunar2Solar(l.day, l.month, l.year, l.leap); // Julian jdToDate branch
    expect(s.y).toBeGreaterThan(0);
  });

  it('handles ancient dates using the old ΔT formula', () => {
    const l = convertSolar2Lunar(1, 1, 700); // t < -11 → ancient-date ΔT branch
    expect(l.day).toBeGreaterThanOrEqual(1);
    expect(l.day).toBeLessThanOrEqual(30);
  });

  it('returns {0,0,0} for a leap month that does not exist that year', () => {
    // 2023 has a leap month 2; requesting a leap month 5 is invalid.
    expect(convertLunar2Solar(1, 5, 2023, true)).toEqual({ d: 0, m: 0, y: 0 });
  });
});
