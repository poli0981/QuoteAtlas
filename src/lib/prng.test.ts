import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32 } from './prng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('yields values in [0, 1)', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)());
  });
});

describe('hashSeed', () => {
  it('is stable for the same string', () => {
    expect(hashSeed('tet|vi|qa')).toBe(hashSeed('tet|vi|qa'));
  });

  it('differs for different strings', () => {
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = hashSeed('20260713|vi|qa');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
