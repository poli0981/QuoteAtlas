/** Sniff a picked file, dedup it, and route it to the image or video importer (docs/03 §4). */
import { importImage } from './import-image';
import { importVideo } from './import-video';
import type { MediaProfile } from './limits';
import { isImageMime, sniffMediaType, type ImportResult, type MediaItem } from './media';

/** SHA-256 of the file's bytes, hex-encoded. Not a security hash — an identity one. */
async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function importMedia(
  file: File,
  profile: MediaProfile,
  media: readonly MediaItem[],
): Promise<ImportResult> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = sniffMediaType(head);
  if (!mime) return { ok: false, reason: 'unsupported' };

  // Hashing is the ONE step that pulls the whole file into the JS heap, so it is
  // handed over as a thunk: each importer awaits it only after the file has
  // cleared its caps, and always before writing to OPFS. Hashing eagerly here
  // would allocate (and digest-copy) a 1 GB phone video that we are about to
  // reject on size — and past V8's max ArrayBuffer it throws, which the UI would
  // surface as "unsupported file type" instead of "too big".
  const hashFile = (): Promise<string> => sha256Hex(file);

  return isImageMime(mime)
    ? importImage(file, profile, media, hashFile)
    : importVideo(file, profile, media, hashFile);
}
