/**
 * Video import (docs/03 §4): sniff → read metadata (duration, height) → decide.
 * No client-side transcoding — over-limit videos are rejected with guidance
 * (the UI points at LosslessCut / HandBrake), never auto-compressed.
 *
 * Memory discipline: a video's bytes must never enter the JS heap. Metadata is
 * read by streaming the blob through an object URL, the caps are decided from
 * that metadata plus `file.size`, and OPFS is handed the Blob to stream itself.
 * The dedup hash is the one thing that *would* pull the whole file in, so it is
 * a lazy thunk the importer only awaits once the file has cleared its caps.
 */
import { putMedia } from '../../lib/storage/media-adapter';
import { capsFor, type MediaProfile } from './limits';
import {
  decideVideoImport,
  extFor,
  findDuplicate,
  isImageMime,
  sniffMediaType,
  type ImportResult,
  type MediaItem,
} from './media';

async function videoMetadata(
  blob: Blob,
): Promise<{ duration: number; width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.preload = 'metadata';
  v.muted = true;
  try {
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => {
        resolve();
      };
      v.onerror = () => {
        reject(new Error('video metadata'));
      };
      v.src = url;
    });
    return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function importVideo(
  file: File,
  profile: MediaProfile,
  media: readonly MediaItem[],
  hashFile: () => Promise<string>,
): Promise<ImportResult> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = sniffMediaType(head);
  if (!mime || isImageMime(mime)) return { ok: false, reason: 'unsupported' };

  const caps = capsFor(profile);

  // Upper-bound size gate, before we even decode metadata: the per-height cap can
  // never exceed the 4K one, so anything larger is a certain 'size' reject. This
  // is the unedited-phone-video case (a 4K clip is easily >1 GB) — bail on the
  // cheap `size` metadata rather than touching the file.
  if (file.size > caps.videoMaxBytes4k) return { ok: false, reason: 'size' };

  let meta: { duration: number; width: number; height: number };
  try {
    meta = await videoMetadata(file);
  } catch {
    return { ok: false, reason: 'unsupported' };
  }

  const videoCount = media.filter((m) => m.kind === 'video').length;
  const decision = decideVideoImport(meta.duration, meta.height, file.size, caps, videoCount);
  // Every reject except 'library-full' means the file is unusable; return before
  // hashing. A 'library-full' reject still means the FILE is fine, so fall through
  // and dedup first — re-picking something you already have costs nothing and must
  // not be reported as a full library.
  if (decision.action === 'reject' && decision.reason !== 'library-full') {
    return { ok: false, reason: decision.reason };
  }

  const hash = await hashFile();
  const existing = findDuplicate(hash, media);
  if (existing) return { ok: false, reason: 'duplicate', existing };
  if (decision.action === 'reject') return { ok: false, reason: decision.reason };

  const id = crypto.randomUUID();
  const ext = extFor(mime);
  await putMedia(`${id}.${ext}`, file);
  return {
    ok: true,
    item: {
      id,
      kind: 'video',
      mime,
      ext,
      bytes: file.size,
      w: meta.width,
      h: meta.height,
      duration: meta.duration,
      addedAt: Date.now(),
      hash,
    },
  };
}
