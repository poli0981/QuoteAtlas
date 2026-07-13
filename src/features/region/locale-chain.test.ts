import { describe, expect, it } from 'vitest';
import { regionsWithPool, resolveLocale } from './locale-chain';
import type { LocaleIndex } from '../quote/types';

const index: LocaleIndex = {
  dataVersion: 1,
  generated: '2026-07-13',
  locales: [
    { code: 'en', file: 'en.json', count: 6, dir: 'ltr', fontKey: 'serif', regions: ['US', 'GB'] },
    { code: 'ja', file: 'ja.json', count: 50, dir: 'ltr', fontKey: 'serif-jp', regions: ['JP'] },
  ],
};

describe('resolveLocale', () => {
  it('uses the region pool when one exists', () => {
    expect(resolveLocale('JP', index, [])).toEqual({ locale: 'ja', fallback: false });
    expect(resolveLocale('US', index, [])).toEqual({ locale: 'en', fallback: false });
  });

  it('falls back via primary language when the region has no pool', () => {
    expect(resolveLocale('KR', index, ['ja-JP', 'en'])).toEqual({ locale: 'ja', fallback: true });
  });

  it('falls back to en when neither region nor language matches', () => {
    expect(resolveLocale('KR', index, ['ko-KR'])).toEqual({ locale: 'en', fallback: true });
  });

  it('is not a fallback when no region is chosen (auto)', () => {
    expect(resolveLocale(null, index, ['fr-FR'])).toEqual({ locale: 'en', fallback: false });
  });
});

describe('regionsWithPool', () => {
  it('collects every region across locales', () => {
    expect(regionsWithPool(index)).toEqual(new Set(['US', 'GB', 'JP']));
  });
});
