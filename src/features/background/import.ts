/** Sniff a picked file and route it to the image or video importer (docs/03 §4). */
import { importImage } from './import-image';
import { importVideo } from './import-video';
import type { MediaProfile } from './limits';
import { isImageMime, sniffMediaType, type ImportResult } from './media';

export async function importMedia(
  file: File,
  profile: MediaProfile,
  imageCount: number,
  videoCount: number,
): Promise<ImportResult> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = sniffMediaType(head);
  if (!mime) return { ok: false, reason: 'unsupported' };
  return isImageMime(mime)
    ? importImage(file, profile, imageCount)
    : importVideo(file, profile, videoCount);
}
