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
  | { ok: false; reason: 'unsupported' | VideoRejectReason | 'uncompressible' };
