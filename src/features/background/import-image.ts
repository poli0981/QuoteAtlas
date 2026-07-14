/**
 * Image import orchestration (docs/03 §4). Sniff → read dimensions → decide →
 * (compress in a canvas via the WebP ladder if over cap) → store in OPFS.
 * WebP encode is feature-detected (Safari falls back to "shrink it yourself").
 */
import { putMedia } from '../../lib/storage/media-adapter';
import { compressViaLadder } from './compressor';
import { capsFor, type MediaProfile } from './limits';
import {
  decideImageImport,
  extFor,
  findDuplicate,
  isImageMime,
  sniffMediaType,
  type ImportResult,
  type MediaItem,
} from './media';

function webpEncodeSupported(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}

async function dimensions(blob: Blob): Promise<{ w: number; h: number }> {
  const bmp = await createImageBitmap(blob);
  const dim = { w: bmp.width, h: bmp.height };
  bmp.close();
  return dim;
}

async function compressImage(blob: Blob, edge: number, capBytes: number): Promise<Blob> {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const { blob: out } = await compressViaLadder(
    (quality) => canvas.convertToBlob({ type: 'image/webp', quality }),
    capBytes,
  );
  return out;
}

export async function importImage(
  file: File,
  profile: MediaProfile,
  media: readonly MediaItem[],
  hashFile: () => Promise<string>,
): Promise<ImportResult> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = sniffMediaType(head);
  if (!mime || !isImageMime(mime)) return { ok: false, reason: 'unsupported' };

  const caps = capsFor(profile);
  const imageCount = media.filter((m) => m.kind === 'image').length;
  const dims = await dimensions(file);
  const decision = decideImageImport(Math.max(dims.w, dims.h), file.size, caps, imageCount);
  // decideImageImport only ever rejects for 'library-full' (an over-cap image is
  // compressed, not refused), so the file is known-importable here either way —
  // dedup first, so re-picking one you already have beats a "library full" error.
  const hash = await hashFile();
  const existing = findDuplicate(hash, media);
  if (existing) return { ok: false, reason: 'duplicate', existing };
  if (decision.action === 'reject') return { ok: false, reason: decision.reason };

  let blob: Blob = file;
  let outMime = mime;
  let outDims = dims;
  if (decision.action === 'compress') {
    if (!webpEncodeSupported()) return { ok: false, reason: 'uncompressible' };
    try {
      blob = await compressImage(file, decision.targetEdge, decision.capBytes);
      outMime = 'image/webp';
      outDims = await dimensions(blob);
    } catch {
      return { ok: false, reason: 'uncompressible' };
    }
  }

  const id = crypto.randomUUID();
  const ext = extFor(outMime);
  await putMedia(`${id}.${ext}`, blob);
  return {
    ok: true,
    item: {
      id,
      kind: 'image',
      mime: outMime,
      ext,
      bytes: blob.size,
      w: outDims.w,
      h: outDims.h,
      addedAt: Date.now(),
      hash,
    },
  };
}
