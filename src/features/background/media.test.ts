import { describe, expect, it } from 'vitest';
import { decideImageImport, decideVideoImport, extFor, isImageMime, sniffMediaType } from './media';
import { capsFor, videoCapBytes } from './limits';

function bytesOf(...vals: number[]): Uint8Array {
  return new Uint8Array([...vals, ...new Array<number>(16).fill(0)]);
}
const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0));

describe('sniffMediaType', () => {
  it('detects images by magic bytes', () => {
    expect(sniffMediaType(bytesOf(0xff, 0xd8, 0xff))).toBe('image/jpeg');
    expect(sniffMediaType(bytesOf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      'image/png',
    );
    expect(sniffMediaType(bytesOf(...ascii('GIF89a')))).toBe('image/gif');
  });

  it('detects RIFF/WEBP and ftyp/avif', () => {
    const webp = new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), 0, 0]);
    expect(sniffMediaType(webp)).toBe('image/webp');
    const avif = new Uint8Array([0, 0, 0, 0, ...ascii('ftyp'), ...ascii('avif'), 0, 0]);
    expect(sniffMediaType(avif)).toBe('image/avif');
  });

  it('detects mp4 (ftyp) and webm (EBML)', () => {
    const mp4 = new Uint8Array([0, 0, 0, 0, ...ascii('ftyp'), ...ascii('isom'), 0, 0]);
    expect(sniffMediaType(mp4)).toBe('video/mp4');
    expect(sniffMediaType(bytesOf(0x1a, 0x45, 0xdf, 0xa3))).toBe('video/webm');
  });

  it('returns null for unsupported bytes', () => {
    expect(sniffMediaType(bytesOf(0x00, 0x01, 0x02))).toBeNull();
  });
});

describe('extFor / isImageMime', () => {
  it('maps mime to extension', () => {
    expect(extFor('image/jpeg')).toBe('jpg');
    expect(extFor('video/webm')).toBe('webm');
  });
  it('classifies image vs video mimes', () => {
    expect(isImageMime('image/png')).toBe(true);
    expect(isImageMime('video/mp4')).toBe(false);
  });
});

describe('decideImageImport', () => {
  const caps = capsFor('web'); // 25 files, 1080≤10MB, 4K≤25MB, edge 3840

  it('accepts an in-cap 1080p image', () => {
    expect(decideImageImport(1600, 2_000_000, caps, 0)).toEqual({ action: 'accept' });
  });

  it('compresses an over-cap 1080p image to the 1920 edge', () => {
    expect(decideImageImport(1600, 20_000_000, caps, 0)).toEqual({
      action: 'compress',
      targetEdge: 1920,
      capBytes: 10 * 1024 * 1024,
    });
  });

  it('compresses an over-cap 4K image to the 3840 edge', () => {
    expect(decideImageImport(3000, 40_000_000, caps, 0)).toEqual({
      action: 'compress',
      targetEdge: 3840,
      capBytes: 25 * 1024 * 1024,
    });
  });

  it('always compresses an oversize (>3840 edge) image down to 3840', () => {
    expect(decideImageImport(6000, 5_000_000, caps, 0)).toEqual({
      action: 'compress',
      targetEdge: 3840,
      capBytes: 25 * 1024 * 1024,
    });
  });

  it('rejects when the library is full', () => {
    expect(decideImageImport(1000, 100, caps, 25)).toEqual({
      action: 'reject',
      reason: 'library-full',
    });
  });
});

describe('videoCapBytes', () => {
  const caps = capsFor('web'); // 1080 ≤50MB, 4K ≤125MB
  it('picks the cap by height', () => {
    expect(videoCapBytes(1080, caps)).toBe(50 * 1024 * 1024);
    expect(videoCapBytes(1440, caps)).toBe(125 * 1024 * 1024);
  });
});

describe('decideVideoImport', () => {
  const caps = capsFor('web'); // 10 files, ≤180+2s, ≤2160px, 1080≤50MB, 4K≤125MB

  it('accepts an in-limits 1080p video', () => {
    expect(decideVideoImport(120, 1080, 30_000_000, caps, 0)).toEqual({ action: 'accept' });
  });

  it('rejects when the library is full', () => {
    expect(decideVideoImport(10, 720, 100, caps, 10)).toEqual({
      action: 'reject',
      reason: 'library-full',
    });
  });

  it('rejects videos over 3:00 (+2s tolerance)', () => {
    expect(decideVideoImport(183, 1080, 100, caps, 0)).toEqual({
      action: 'reject',
      reason: 'duration',
    });
    expect(decideVideoImport(182, 1080, 100, caps, 0)).toEqual({ action: 'accept' });
  });

  it('accepts a video whose duration is unknown (non-finite)', () => {
    // MediaRecorder WebM without a Duration element reports Infinity — that is
    // "unknown", not "too long", so it must not be rejected on duration.
    expect(decideVideoImport(Infinity, 1080, 30_000_000, caps, 0)).toEqual({ action: 'accept' });
    expect(decideVideoImport(Number.NaN, 1080, 30_000_000, caps, 0)).toEqual({ action: 'accept' });
  });

  it('rejects videos taller than 4K', () => {
    expect(decideVideoImport(10, 2161, 100, caps, 0)).toEqual({
      action: 'reject',
      reason: 'resolution',
    });
  });

  it('rejects videos over the byte cap for their height', () => {
    expect(decideVideoImport(10, 1080, 60_000_000, caps, 0)).toEqual({
      action: 'reject',
      reason: 'size',
    });
    expect(decideVideoImport(10, 2000, 140_000_000, caps, 0)).toEqual({
      action: 'reject',
      reason: 'size',
    });
  });
});
