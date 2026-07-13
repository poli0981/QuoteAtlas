import { describe, expect, it } from 'vitest';
import { attributionMarkdown, attributionSegments, attributionText } from './attribution';
import type { Attribution, QuoteRecord, QuoteType } from './types';

// Invented placeholders only — no real third-party lines in fixtures (docs/11 §7).
function rec(type: QuoteType, attribution: Partial<Attribution>): QuoteRecord {
  const base: Attribution = {
    work: null,
    character: null,
    actor: null,
    author: null,
    developer: null,
    publisher: null,
    source: null,
    year: null,
    links: {},
    rights: 'public-domain',
  };
  return {
    id: `x-0001`,
    type,
    text: 'placeholder',
    lang: 'en',
    translations: {},
    attribution: { ...base, ...attribution },
    regions: [],
    tags: [],
    holidays: [],
  };
}

describe('attribution — proverb', () => {
  it('renders the source label only, no link', () => {
    const r = rec('proverb', { source: 'Placeholder Proverbs', rights: 'public-domain' });
    expect(attributionSegments(r)).toEqual([{ text: 'Placeholder Proverbs' }]);
    expect(attributionText(r)).toBe('— Placeholder Proverbs');
    expect(attributionMarkdown(r)).toBe('— Placeholder Proverbs');
  });
});

describe('attribution — quote', () => {
  it('renders author with link when present', () => {
    const r = rec('quote', {
      author: 'A. Placeholder',
      links: { author: 'https://example.org/a' },
    });
    expect(attributionSegments(r)).toEqual([
      { text: 'A. Placeholder', href: 'https://example.org/a' },
    ]);
    expect(attributionMarkdown(r)).toBe('— [A. Placeholder](https://example.org/a)');
  });

  it('falls back to source when author is absent, dropping the link', () => {
    const r = rec('quote', { source: 'Unknown', links: { author: 'https://example.org/a' } });
    expect(attributionSegments(r)).toEqual([{ text: 'Unknown' }]);
    expect(attributionText(r)).toBe('— Unknown');
  });
});

describe('attribution — movie', () => {
  it('renders Work (linked) – Character – Actor', () => {
    const r = rec('movie', {
      work: 'Placeholder Film',
      character: 'The Hero',
      actor: 'Jane Placeholder',
      links: { work: 'https://imdb.com/title/tt0000000' },
    });
    expect(attributionSegments(r)).toEqual([
      { text: 'Placeholder Film', href: 'https://imdb.com/title/tt0000000' },
      { text: 'The Hero' },
      { text: 'Jane Placeholder' },
    ]);
    expect(attributionText(r)).toBe('— Placeholder Film – The Hero – Jane Placeholder');
  });

  it('collapses missing optional fields (no actor)', () => {
    const r = rec('movie', { work: 'Placeholder Film', character: 'The Hero' });
    expect(attributionSegments(r).map((s) => s.text)).toEqual(['Placeholder Film', 'The Hero']);
    expect(attributionText(r)).toBe('— Placeholder Film – The Hero');
  });
});

describe('attribution — book', () => {
  it('renders Character – Work (linked) – Author (linked)', () => {
    const r = rec('book', {
      character: 'Narrator',
      work: 'Placeholder Novel',
      author: 'B. Placeholder',
      links: { work: 'https://wikipedia.org/wiki/x', author: 'https://wikipedia.org/wiki/b' },
    });
    expect(attributionSegments(r)).toEqual([
      { text: 'Narrator' },
      { text: 'Placeholder Novel', href: 'https://wikipedia.org/wiki/x' },
      { text: 'B. Placeholder', href: 'https://wikipedia.org/wiki/b' },
    ]);
    expect(attributionMarkdown(r)).toBe(
      '— Narrator – [Placeholder Novel](https://wikipedia.org/wiki/x) – [B. Placeholder](https://wikipedia.org/wiki/b)',
    );
  });
});

describe('attribution — game', () => {
  it('renders Character – Work (linked) – Developer', () => {
    const r = rec('game', {
      character: 'Player One',
      work: 'Placeholder Quest',
      developer: 'Placeholder Studios',
      links: { work: 'https://store.steampowered.com/app/0' },
    });
    expect(attributionSegments(r).map((s) => s.text)).toEqual([
      'Player One',
      'Placeholder Quest',
      'Placeholder Studios',
    ]);
  });

  it('falls back to publisher when developer is absent', () => {
    const r = rec('game', { work: 'Placeholder Quest', publisher: 'Placeholder Publishing' });
    expect(attributionSegments(r).map((s) => s.text)).toEqual([
      'Placeholder Quest',
      'Placeholder Publishing',
    ]);
  });
});

describe('attribution — parity & edge cases', () => {
  it('markdown has the same segment count as segments', () => {
    const r = rec('book', {
      character: 'Narrator',
      work: 'Placeholder Novel',
      author: 'B. Placeholder',
      links: { work: 'https://wikipedia.org/wiki/x' },
    });
    const segCount = attributionSegments(r).length;
    const mdCount = attributionMarkdown(r).split(' – ').length;
    expect(mdCount).toBe(segCount);
  });

  it('returns empty output when nothing is attributable', () => {
    const r = rec('proverb', {});
    expect(attributionSegments(r)).toEqual([]);
    expect(attributionText(r)).toBe('');
    expect(attributionMarkdown(r)).toBe('');
  });
});
