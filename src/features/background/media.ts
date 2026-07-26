/**
 * Media types + import decisions (docs/03 §4, docs/04 §6). Pure: type sniffing
 * by magic bytes (never trusting extensions) and the accept/compress/reject
 * decision live here; the DOM parts (decode, canvas) sit in import-image.ts.
 */
import { classifyImage, imageCapBytes, targetEdge, videoCapBytes, type MediaCaps } from './limits';

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'image/gif';
export type VideoMime = 'video/mp4' | 'video/webm';
export type MediaMime = ImageMime | VideoMime;

export interface MediaItem {
  id: string;
  kind: 'image' | 'video';
  mime: MediaMime;
  ext: string;
  bytes: number;
  w: number;
  h: number;
  duration?: number;
  addedAt: number;
  /**
   * SHA-256 of the ORIGINAL picked file, used to spot a re-upload of the same
   * file (docs/04 §6). Hashing the source rather than the stored blob matters for
   * images: those are re-encoded to WebP on import, so the stored bytes differ
   * even when the user picked the identical file. Optional — items imported
   * before dedup existed have no hash and simply never match.
   */
  hash?: string;
}

const EXT: Record<MediaMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export function extFor(mime: MediaMime): string {
  return EXT[mime];
}

export function isImageMime(mime: MediaMime): mime is ImageMime {
  return mime.startsWith('image/');
}

function has(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  return sig.every((b, i) => bytes[offset + i] === b);
}

const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0));

/** Detect a supported media type from the leading bytes; null if unsupported. */
export function sniffMediaType(bytes: Uint8Array): MediaMime | null {
  if (has(bytes, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (has(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (has(bytes, 0, ascii('GIF8'))) return 'image/gif';
  if (has(bytes, 0, ascii('RIFF')) && has(bytes, 8, ascii('WEBP'))) return 'image/webp';
  if (has(bytes, 4, ascii('ftyp'))) {
    if (has(bytes, 8, ascii('avif')) || has(bytes, 8, ascii('avis'))) return 'image/avif';
    return 'video/mp4'; // isom / mp42 / etc.
  }
  if (has(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  return null;
}

export type ImageDecision =
  | { action: 'accept' }
  | { action: 'compress'; targetEdge: number; capBytes: number }
  | { action: 'reject'; reason: 'library-full' };

/** Decide how to import an image given its size/dimensions (docs/03 §4). */
export function decideImageImport(
  longEdge: number,
  bytes: number,
  caps: MediaCaps,
  currentCount: number,
): ImageDecision {
  if (currentCount >= caps.imageMaxFiles) return { action: 'reject', reason: 'library-full' };
  const klass = classifyImage(longEdge, caps);
  if (klass !== 'OVERSIZE') {
    const cap = imageCapBytes(klass, caps);
    if (bytes <= cap) return { action: 'accept' };
    return { action: 'compress', targetEdge: targetEdge(klass, caps), capBytes: cap };
  }
  // Longer than the max edge → always resize down to the 4K edge and re-encode.
  return { action: 'compress', targetEdge: caps.imageMaxLongEdge, capBytes: caps.imageMaxBytes4k };
}

export type VideoRejectReason = 'library-full' | 'duration' | 'resolution' | 'size';
export type VideoDecision = { action: 'accept' } | { action: 'reject'; reason: VideoRejectReason };

/**
 * Decide whether to accept a video (docs/03 §4). No client-side transcoding —
 * over-limit videos are rejected with guidance rather than compressed.
 */
export function decideVideoImport(
  durationSec: number,
  height: number,
  bytes: number,
  caps: MediaCaps,
  currentCount: number,
): VideoDecision {
  // A non-finite duration (Infinity/NaN — e.g. MediaRecorder WebM without a
  // Duration element) is unknown, not "too long"; only reject a measured one.
  if (
    Number.isFinite(durationSec) &&
    durationSec > caps.videoMaxSeconds + caps.videoToleranceSeconds
  ) {
    return { action: 'reject', reason: 'duration' };
  }
  if (height > caps.videoMaxHeight) return { action: 'reject', reason: 'resolution' };
  if (bytes > videoCapBytes(height, caps)) return { action: 'reject', reason: 'size' };
  // Library-full is checked LAST on purpose: a 'library-full' reject then also
  // *proves the file itself is within caps*, which is what lets the importer hash
  // it for dedup — so re-picking a file you already have says "already in your
  // library" rather than "library full", without ever reading an oversized file.
  if (currentCount >= caps.videoMaxFiles) return { action: 'reject', reason: 'library-full' };
  return { action: 'accept' };
}

/**
 * Find an already-imported item with the same content hash (docs/04 §6).
 *
 * Re-picking a file the library already holds should be idempotent — storing a
 * second OPFS copy would burn the user's quota and their file-count cap for a
 * byte-identical background. Items predating the hash field never match, so an
 * existing library degrades to the old behaviour instead of mis-matching.
 */
export function findDuplicate(hash: string, items: readonly MediaItem[]): MediaItem | undefined {
  return items.find((m) => m.hash === hash);
}

/** Result of importing a media file (shared by the image + video importers). */
export type ImportResult =
  | { ok: true; item: MediaItem }
  /** the picked file is already in the library — `existing` is the item to reuse */
  | { ok: false; reason: 'duplicate'; existing: MediaItem }
  | { ok: false; reason: 'unsupported' | VideoRejectReason | 'uncompressible' | 'aspect' };

/** A display's pixel dimensions — the reference the aspect gate judges against. */
export interface ScreenSize {
  w: number;
  h: number;
}

/** Long edge ÷ short edge, or null when the dimensions are unusable. */
function longShortRatio(w: number, h: number): number | null {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return Math.max(w, h) / Math.min(w, h);
}

/**
 * The fraction of the media that survives being fitted to the screen with
 * `cover` — the mode both the image and video backgrounds use (docs/03 §4).
 *
 * Orientation-agnostic on purpose: both ratios are normalised to long ÷ short, so
 * a 9:16 clip on a 16:9 phone scores a perfect fit. It *is* one — held upright —
 * and refusing it because the device happens to be landscape at import time would
 * be arbitrary, since the window can rotate a second later.
 *
 * Returns 1 for any unusable dimension: a screen we cannot measure must never
 * block an import.
 */
export function visibleFractionUnderCover(
  mediaW: number,
  mediaH: number,
  screenW: number,
  screenH: number,
): number {
  const media = longShortRatio(mediaW, mediaH);
  const screen = longShortRatio(screenW, screenH);
  if (media == null || screen == null) return 1;
  return Math.min(media, screen) / Math.max(media, screen);
}

/**
 * A 4:3 picture on a 16:9 display lands *exactly* on a 0.75 threshold, and binary
 * floating point does not agree with itself about whether (4/3)/(16/9) is 0.75.
 * Accept the boundary explicitly rather than letting the last bit decide.
 */
const ASPECT_EPSILON = 1e-9;

export type AspectDecision = { action: 'accept' } | { action: 'reject'; reason: 'aspect' };

/** Refuse media that `cover` would crop beyond the cap (docs/03 §4, docs/04 §7). */
export function decideAspect(
  mediaW: number,
  mediaH: number,
  screen: ScreenSize,
  caps: MediaCaps,
): AspectDecision {
  const visible = visibleFractionUnderCover(mediaW, mediaH, screen.w, screen.h);
  return visible >= caps.minVisibleFraction - ASPECT_EPSILON
    ? { action: 'accept' }
    : { action: 'reject', reason: 'aspect' };
}

/**
 * Largest ratio term still readable as a shape. Past it, decimals communicate
 * better: an ultrawide 3440×1440 reduces to "43:18", which tells nobody anything,
 * where "2.39:1" is a ratio people recognise.
 */
const MAX_RATIO_TERM = 21;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * A display's shape written the way a person would say it: "16:9" when it reduces
 * to small whole numbers, "1.54:1" when it does not (plenty of laptop panels do
 * not reduce). Used to tell the user what shape to aim for instead of only that
 * their file was wrong.
 */
export function formatAspectRatio(w: number, h: number): string {
  const long = Math.round(Math.max(w, h));
  const short = Math.round(Math.min(w, h));
  if (short <= 0 || !Number.isFinite(long)) return '1:1';
  const g = gcd(long, short) || 1;
  const a = long / g;
  const b = short / g;
  return a <= MAX_RATIO_TERM ? `${a}:${b}` : `${(long / short).toFixed(2)}:1`;
}
