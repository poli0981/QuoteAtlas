import { describe, expect, it } from 'vitest';
import { detect } from './detect';

const tzMap: Record<string, string> = { 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Tokyo': 'JP' };

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
