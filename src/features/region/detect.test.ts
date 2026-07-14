import { describe, expect, it } from 'vitest';
import { detect } from './detect';
import tzData from './tz-to-country.json';

const tzMap: Record<string, string> = { 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Tokyo': 'JP' };
const shipped: Record<string, string> = tzData.map;

describe('detect', () => {
  it('resolves country from timezone', () => {
    expect(detect(tzMap, { timeZone: 'Asia/Ho_Chi_Minh', languages: [] })).toBe('VN');
  });

  it('falls back to the language region subtag for unmapped zones (Etc/UTC)', () => {
    expect(detect(tzMap, { timeZone: 'Etc/UTC', languages: ['vi-VN'] })).toBe('VN');
  });

  it('skips script subtags and uppercases the region', () => {
    expect(detect({}, { timeZone: 'Etc/UTC', languages: ['zh-Hant', 'en-us'] })).toBe('US');
  });

  it('handles UN M49 numeric region codes (es-419)', () => {
    expect(detect({}, { timeZone: 'Etc/UTC', languages: ['es-419'] })).toBe('419');
  });

  it('returns null when neither timezone nor language yields a region', () => {
    expect(detect({}, { timeZone: 'Etc/UTC', languages: ['en'] })).toBeNull();
  });
});

describe('shipped tz map', () => {
  it('routes every spelling browsers report for the Vietnam zone', () => {
    // Browsers disagree: Chromium's ICU canonicalizes Asia/Ho_Chi_Minh →
    // Asia/Saigon. With only the IANA spelling mapped, detection fell through to
    // the language subtag and reported a VN user on an en-US build as US.
    const languages = ['en-US'];
    expect(detect(shipped, { timeZone: 'Asia/Ho_Chi_Minh', languages })).toBe('VN');
    expect(detect(shipped, { timeZone: 'Asia/Saigon', languages })).toBe('VN');
  });

  it('routes the other alias spellings of zones it already covers', () => {
    expect(detect(shipped, { timeZone: 'Asia/Calcutta', languages: [] })).toBe('IN');
    expect(detect(shipped, { timeZone: 'Asia/Kolkata', languages: [] })).toBe('IN');
    expect(detect(shipped, { timeZone: 'US/Pacific', languages: [] })).toBe('US');
  });
});
