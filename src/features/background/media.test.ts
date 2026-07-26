import { describe, expect, it } from 'vitest';
import {
  decideAspect,
  decideImageImport,
  decideVideoImport,
  extFor,
  findDuplicate,
  formatAspectRatio,
  isImageMime,
  sniffMediaType,
  visibleFractionUnderCover,
  type MediaItem,
} from './media';
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

describe('findDuplicate', () => {
  const item = (id: string, hash?: string): MediaItem => ({
    id,
    kind: 'image',
    mime: 'image/png',
    ext: 'png',
    bytes: 10,
    w: 1,
    h: 1,
    addedAt: 0,
    ...(hash == null ? {} : { hash }),
  });

  it('matches an item with the same content hash', () => {
    const items = [item('a', 'aaa'), item('b', 'bbb')];
    expect(findDuplicate('bbb', items)?.id).toBe('b');
  });

  it('returns undefined when nothing matches', () => {
    expect(findDuplicate('zzz', [item('a', 'aaa')])).toBeUndefined();
  });

  it('never matches legacy items that predate the hash field', () => {
    // An item imported before dedup existed has no hash — it must not collide
    // with a freshly hashed file just because both are "missing" a value.
    const legacy = [item('old')];
    expect(findDuplicate('aaa', legacy)).toBeUndefined();
    expect(legacy[0]?.hash).toBeUndefined();
  });

  it('finds nothing in an empty library', () => {
    expect(findDuplicate('aaa', [])).toBeUndefined();
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

  it('reports the cap breach, not "library full", when the file is ALSO unusable', () => {
    // Precedence matters beyond the message: a 'library-full' reject is the caller's
    // proof that the FILE is fine, which is what lets the importer hash it for dedup
    // without risking a huge read on a file it was going to reject anyway.
    expect(decideVideoImport(300, 1080, 100, caps, 10)).toEqual({
      action: 'reject',
      reason: 'duration',
    });
    expect(decideVideoImport(10, 1080, 60_000_000, caps, 10)).toEqual({
      action: 'reject',
      reason: 'size',
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

describe('visibleFractionUnderCover', () => {
  it('is 1 for an exact match, in either orientation', () => {
    expect(visibleFractionUnderCover(1920, 1080, 2560, 1440)).toBeCloseTo(1, 10);
    // orientation-agnostic: a portrait clip is a perfect fit for a landscape
    // phone, because the phone can be held upright
    expect(visibleFractionUnderCover(1080, 1920, 2560, 1440)).toBeCloseTo(1, 10);
  });

  it('reports the area a cover fit would keep', () => {
    // 4:3 on 16:9 → the sides survive, (4/3)/(16/9) of the frame
    expect(visibleFractionUnderCover(1600, 1200, 1920, 1080)).toBeCloseTo(0.75, 10);
    // square on 16:9 → barely more than half
    expect(visibleFractionUnderCover(1000, 1000, 1920, 1080)).toBeCloseTo(0.5625, 10);
    // ultrawide on 16:9 → the ends get cropped instead, same formula
    expect(visibleFractionUnderCover(2560, 1080, 1920, 1080)).toBeCloseTo(0.75, 4);
  });

  it('treats unusable dimensions as "cannot tell", never as a reason to block', () => {
    const cases: [number, number, number, number][] = [
      [0, 1080, 1920, 1080],
      [1920, 0, 1920, 1080],
      [1920, 1080, 0, 0],
      [Number.NaN, 1080, 1920, 1080],
      [1920, 1080, Infinity, 1080],
      [-1920, 1080, 1920, 1080],
    ];
    for (const [mw, mh, sw, sh] of cases) {
      expect(visibleFractionUnderCover(mw, mh, sw, sh)).toBe(1);
    }
  });
});

describe('decideAspect', () => {
  const caps = capsFor('web');
  const wide = { w: 1920, h: 1080 };

  it('accepts an exact match and a portrait file of the same shape', () => {
    expect(decideAspect(3840, 2160, wide, caps)).toEqual({ action: 'accept' });
    expect(decideAspect(1080, 1920, wide, caps)).toEqual({ action: 'accept' });
  });

  it('accepts 4:3 on 16:9 — exactly on the threshold', () => {
    // This is the case binary floats disagree about: (4/3)/(16/9) is 0.75 in
    // decimal and 0.7500000000000001 in doubles. It must not depend on that.
    expect(decideAspect(1600, 1200, wide, caps)).toEqual({ action: 'accept' });
    expect(decideAspect(4, 3, wide, caps)).toEqual({ action: 'accept' });
  });

  it('rejects a square, which loses 44% of itself on a 16:9 display', () => {
    expect(decideAspect(1000, 1000, wide, caps)).toEqual({ action: 'reject', reason: 'aspect' });
  });

  it('scores a 9:16 clip exactly like a 16:9 one — orientation is not the test', () => {
    // 4:3 display: both normalise to 1.778 vs 1.333, i.e. exactly on the line.
    const fourThree = { w: 1024, h: 768 };
    expect(decideAspect(1080, 1920, fourThree, caps)).toEqual({ action: 'accept' });
    expect(decideAspect(1920, 1080, fourThree, caps)).toEqual({ action: 'accept' });

    // …and both fail together once the display is squarer than that.
    const fiveFour = { w: 1280, h: 1024 };
    expect(decideAspect(1080, 1920, fiveFour, caps)).toEqual({
      action: 'reject',
      reason: 'aspect',
    });
    expect(decideAspect(1920, 1080, fiveFour, caps)).toEqual({
      action: 'reject',
      reason: 'aspect',
    });
  });

  it('lets everything through when the screen cannot be measured', () => {
    expect(decideAspect(1000, 1000, { w: 0, h: 0 }, caps)).toEqual({ action: 'accept' });
  });

  it('is stricter on a tall phone, which is the point', () => {
    // 20:9 phone: a 4:3 photo really does lose 40% of itself to the crop
    const phone = { w: 1080, h: 2400 };
    expect(decideAspect(1600, 1200, phone, caps)).toEqual({ action: 'reject', reason: 'aspect' });
    expect(decideAspect(1920, 1080, phone, caps)).toEqual({ action: 'accept' });
  });
});

describe('formatAspectRatio', () => {
  it('reduces common displays to the shape people name', () => {
    expect(formatAspectRatio(1920, 1080)).toBe('16:9');
    expect(formatAspectRatio(1024, 768)).toBe('4:3');
    // fully reduced, so a 16:10 panel reads as 8:5 — the same shape, said shorter
    expect(formatAspectRatio(2560, 1600)).toBe('8:5');
    // orientation-agnostic, like the gate itself
    expect(formatAspectRatio(1080, 2400)).toBe('20:9');
  });

  it('falls back to decimals when the reduction is not a shape', () => {
    expect(formatAspectRatio(1512, 982)).toBe('1.54:1');
    // 3440×1440 reduces to 43:18, which communicates nothing
    expect(formatAspectRatio(3440, 1440)).toBe('2.39:1');
  });

  it('never divides by zero', () => {
    expect(formatAspectRatio(0, 0)).toBe('1:1');
  });
});
