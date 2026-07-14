import { describe, expect, it } from 'vitest';
import { select, type SelectContext } from './engine';
import type { QuoteRecord } from './types';
import type { HolidayTags } from '../holidays/types';

const NO_HOLIDAYS: HolidayTags = { national: [], international: [] };

function pool(ids: string[], holidays: Record<string, string[]> = {}): QuoteRecord[] {
  return ids.map((id) => ({
    id,
    type: 'proverb',
    text: id,
    lang: 'en',
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
    regions: ['US'],
    tags: [],
    holidays: holidays[id] ?? [],
  }));
}

function ctx(over: Partial<SelectContext> & Pick<SelectContext, 'pool'>): SelectContext {
  return {
    mode: 'per-load',
    history: [],
    holidayTags: NO_HOLIDAYS,
    locale: 'en',
    dateKey: '20260713',
    ...over,
  };
}

describe('select — empty pool', () => {
  it('returns null when the pool is empty', () => {
    expect(select(ctx({ pool: [] }))).toBeNull();
  });
});

describe('select — daily mode determinism', () => {
  const p = pool(['a', 'b', 'c', 'd', 'e']);

  it('is stable for the same day + locale', () => {
    const one = select(ctx({ pool: p, mode: 'daily' }));
    const two = select(ctx({ pool: p, mode: 'daily' }));
    expect(one?.quote.id).toBe(two?.quote.id);
  });

  it('is deterministic per locale (ignores injected rng)', () => {
    const withRng = select(ctx({ pool: p, mode: 'daily', rng: () => 0.99 }));
    const plain = select(ctx({ pool: p, mode: 'daily' }));
    expect(withRng?.quote.id).toBe(plain?.quote.id);
  });
});

describe('select — anti-repeat ring', () => {
  it('does not repeat within the pool while candidates remain', () => {
    const p = pool(['a', 'b', 'c', 'd']);
    let history: string[] = [];
    const seen: string[] = [];
    // rng always 0 → always pick candidates[0], which walks distinct ids.
    p.forEach(() => {
      const r = select(ctx({ pool: p, history, rng: () => 0 }));
      expect(r).not.toBeNull();
      if (r) {
        seen.push(r.quote.id);
        history = r.history;
      }
    });
    expect(new Set(seen).size).toBe(p.length);
  });

  it('resets the ring rather than blanking when the pool is exhausted', () => {
    const p = pool(['a', 'b']);
    const r = select(ctx({ pool: p, history: ['a', 'b'], rng: () => 0 }));
    expect(r).not.toBeNull();
    expect(r?.history).toEqual([r?.quote.id]); // ring was cleared, then this pick pushed
  });

  it('does not re-serve the on-screen quote when the ring resets', () => {
    const p = pool(['a', 'b', 'c']);
    // 'c' is on screen (last in history) and every id is used, so the ring resets.
    // Whatever the rng lands on, `next` must actually move — re-picking the visible
    // quote makes the button look broken.
    for (const r of [0, 0.5, 0.99]) {
      const next = select(ctx({ pool: p, history: ['a', 'b', 'c'], rng: () => r }));
      expect(next?.quote.id).not.toBe('c');
    }
  });

  it('still serves the only quote of a one-quote pool after a reset', () => {
    const p = pool(['solo']);
    const r = select(ctx({ pool: p, history: ['solo'], rng: () => 0 }));
    expect(r?.quote.id).toBe('solo');
  });

  it('evicts oldest ids beyond the 50-entry cap', () => {
    const p = pool(Array.from({ length: 60 }, (_, i) => `q${i}`));
    let history = Array.from({ length: 50 }, (_, i) => `old${i}`);
    const r = select(ctx({ pool: p, history, rng: () => 0 }));
    if (r) history = r.history;
    expect(history.length).toBe(50);
    expect(history).not.toContain('old0');
  });
});

describe('select — holiday precedence', () => {
  it('restricts to holiday quotes when tags match', () => {
    const p = pool(['a', 'b', 'c'], { a: ['tet'] });
    const r = select(
      ctx({ pool: p, holidayTags: { national: ['tet'], international: [] }, rng: () => 0 }),
    );
    expect(r?.quote.id).toBe('a');
  });

  it('uses the full pool when no holiday tags are active', () => {
    const p = pool(['a', 'b', 'c']);
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const r = select(ctx({ pool: p, rng: () => i / 20 }));
      if (r) ids.add(r.quote.id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('select — default RNG path', () => {
  it('returns a valid quote in per-load mode without an injected rng', () => {
    const p = pool(['a', 'b', 'c']);
    const r = select(ctx({ pool: p }));
    expect(r).not.toBeNull();
    expect(p.map((q) => q.id)).toContain(r?.quote.id);
  });
});
