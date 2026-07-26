/**
 * Rasterize the app mark into the PNG sizes the web needs (docs/00 §8.6).
 *
 * `public/icon.svg` covers `<link rel="icon">`, but three consumers refuse SVG:
 * Safari's apple-touch-icon, Android's PWA install prompt, and social cards.
 * Rather than hand-maintain four PNGs that can drift from the SVG, this derives
 * them from the same two shapes the SVG draws — so the mark has exactly one
 * definition and `npm run gen:icons` reproduces the files byte-for-byte.
 *
 * No image dependency: the mark is a filled rect plus one triangle, which is a
 * point-in-triangle test per sample, and PNG is a zlib stream once you write the
 * CRC yourself. Adding sharp/resvg for this would mean a new runtime dep and a
 * GPL-compatibility review (CLAUDE.md R5) for two triangles.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Point = readonly [number, number];

/** The mark, in the SVG's 512×512 user space (public/icon.svg). */
const VIEWBOX = 512;
const TRIANGLE: readonly [Point, Point, Point] = [
  [256, 100],
  [412, 412],
  [100, 412],
];
const BG = 0x00;
const FG = 0xff;

/** Samples per axis. 4 ⇒ 16 samples/pixel, which is enough for three straight edges. */
const SUPERSAMPLE = 4;

/**
 * Maskable icons are cropped to an arbitrary shape; only the centre circle of
 * 80% diameter is guaranteed visible. The mark's lower corners sit at 220px from
 * the centre in a 512 canvas, just past that circle's 204.8px radius, so the
 * maskable variant shrinks the triangle about the centre. The black field still
 * bleeds to every edge, which is what makes the crop invisible.
 */
const MASKABLE_SCALE = 0.9;

interface IconSpec {
  file: string;
  size: number;
  scale: number;
}

const ICONS: readonly IconSpec[] = [
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: MASKABLE_SCALE },
];

/** Signed area of (a, b, p) — the barycentric edge function. */
function edge(a: Point, b: Point, px: number, py: number): number {
  return (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
}

/** Scale the mark about the canvas centre, then map user space to pixels. */
function scaledTriangle(size: number, scale: number): [Point, Point, Point] {
  const c = VIEWBOX / 2;
  const k = (size / VIEWBOX) * scale;
  const map = ([x, y]: Point): Point => [(x - c) * k + size / 2, (y - c) * k + size / 2];
  return [map(TRIANGLE[0]), map(TRIANGLE[1]), map(TRIANGLE[2])];
}

/** Grayscale coverage raster of the mark: 0 = background, 255 = fully inside. */
function rasterize(size: number, scale: number): Uint8Array {
  const [a, b, c] = scaledTriangle(size, scale);
  // Vertex order decides the sign of every edge function; normalise so "inside"
  // is always "all three non-negative" regardless of winding.
  const winding = Math.sign(edge(a, b, c[0], c[1])) || 1;
  const step = 1 / SUPERSAMPLE;
  const offset = step / 2;
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  const out = new Uint8Array(size * size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = px + sx * step + offset;
          const y = py + sy * step + offset;
          const inside =
            edge(a, b, x, y) * winding >= 0 &&
            edge(b, c, x, y) * winding >= 0 &&
            edge(c, a, x, y) * winding >= 0;
          if (inside) hits++;
        }
      }
      out[py * size + px] = BG + Math.round(((FG - BG) * hits) / samples);
    }
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const body = Buffer.concat([head.subarray(4), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, data, tail]);
}

/** Encode an opaque 8-bit RGB PNG. The mark has no transparency — it is a tile. */
function encodePng(gray: Uint8Array, size: number): Buffer {
  // Filter byte 0 (None) per scanline: the mark is flat colour over most of the
  // image, so deflate already collapses it and adaptive filtering buys nothing.
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    let p = y * (1 + size * 3);
    raw[p++] = 0;
    for (let x = 0; x < size; x++) {
      const v = gray[y * size + x]!;
      raw[p++] = v;
      raw[p++] = v;
      raw[p++] = v;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  // 10-12 stay 0: deflate compression, adaptive filtering, no interlace.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

const outDir = join(process.cwd(), 'public');
for (const { file, size, scale } of ICONS) {
  const png = encodePng(rasterize(size, scale), size);
  writeFileSync(join(outDir, file), png);
  console.log(`gen:icons — public/${file} (${size}×${size}, ${png.length} B)`);
}
