/**
 * Deterministic PRNG for content shuffling (docs/05 §1).
 *
 * NOT cryptography — never use for anything security-sensitive. Good enough for
 * stable daily-quote seeding and anti-repeat shuffling.
 */

/** `mulberry32`: tiny deterministic PRNG. Returns a generator yielding [0, 1). */
export function mulberry32(a: number): () => number {
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit string hash (over UTF-16 code units) → unsigned integer seed. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}
