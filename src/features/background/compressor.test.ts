import { describe, expect, it } from 'vitest';
import { compressViaLadder, WEBP_QUALITY_LADDER } from './compressor';
import { QaError } from '../../lib/qa-error';

function blobOfSize(n: number): Blob {
  return new Blob([new Uint8Array(n)]);
}

describe('compressViaLadder', () => {
  it('returns the first quality step whose blob fits under the cap', async () => {
    const sizes = [300, 200, 90, 80]; // decreasing per ladder step
    const encode = (q: number): Promise<Blob> => {
      const idx = WEBP_QUALITY_LADDER.findIndex((x) => x === q);
      return Promise.resolve(blobOfSize(sizes[idx] ?? 0));
    };
    const res = await compressViaLadder(encode, 100);
    expect(res.quality).toBe(0.65);
    expect(res.blob.size).toBe(90);
  });

  it('tries qualities in ladder order, then throws when nothing fits', async () => {
    const tried: number[] = [];
    const encode = (q: number): Promise<Blob> => {
      tried.push(q);
      return Promise.resolve(blobOfSize(1000));
    };
    await expect(compressViaLadder(encode, 100)).rejects.toBeInstanceOf(QaError);
    expect(tried).toEqual([...WEBP_QUALITY_LADDER]);
  });

  it('throws E_MEDIA_UNCOMPRESSIBLE with the right code', async () => {
    const encode = (): Promise<Blob> => Promise.resolve(blobOfSize(1000));
    await expect(compressViaLadder(encode, 100)).rejects.toMatchObject({
      code: 'E_MEDIA_UNCOMPRESSIBLE',
    });
  });

  it('accepts the first step immediately when it already fits', async () => {
    const encode = (): Promise<Blob> => Promise.resolve(blobOfSize(50));
    const res = await compressViaLadder(encode, 100);
    expect(res.quality).toBe(0.8);
  });
});
