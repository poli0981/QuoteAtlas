/**
 * Video import (docs/03 §4): sniff → read metadata (duration, height) → decide.
 * No client-side transcoding — over-limit videos are rejected with guidance
 * (the UI points at LosslessCut / HandBrake), never auto-compressed.
 */
import { putMedia } from '../../lib/storage/media-adapter';
import { capsFor, type MediaProfile } from './limits';
import { decideVideoImport, extFor, isImageMime, sniffMediaType, type ImportResult } from './media';

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
  currentCount: number,
): Promise<ImportResult> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = sniffMediaType(head);
  if (!mime || isImageMime(mime)) return { ok: false, reason: 'unsupported' };

  const caps = capsFor(profile);
  let meta: { duration: number; width: number; height: number };
  try {
    meta = await videoMetadata(file);
  } catch {
    return { ok: false, reason: 'unsupported' };
  }

  const decision = decideVideoImport(meta.duration, meta.height, file.size, caps, currentCount);
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
    },
  };
}
