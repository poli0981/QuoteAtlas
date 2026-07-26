/**
 * Media file storage (docs/02 §4, docs/04 §6). Web AND Android use OPFS
 * (`/backgrounds/<id>.<ext>`); desktop uses the Tauri fs plugin
 * (`$APPDATA/backgrounds/<id>.<ext>`) and serves files through the asset protocol.
 * Binaries never live in settings — only the index does. Tauri modules are loaded
 * via dynamic import inside the native branches so the web bundle stays Tauri-free.
 *
 * Android deliberately takes the OPFS branch, not the Tauri one (a deviation from
 * the "native shells use native storage" sketch in docs/02 §4). Its WebView is
 * Chromium — minSdk is 31 and the System WebView auto-updates, so OPFS is well
 * past its Chromium 109 baseline — while the Tauri path has three Android-only
 * failure modes that OPFS simply does not have:
 *   1. `convertFileSrc` returns `http://asset.localhost/…` on Android (and
 *      Windows), a *different origin* from the page, so every media URL has to
 *      clear the CSP as a remote host rather than as `asset:`.
 *   2. `$APPDATA` resolves to `/data/user/0/<id>`, but Tauri canonicalises the
 *      request path before matching it against the configured scope, and
 *      `/data/user/0` is a symlink to `/data/data`. Paths that do not exist yet
 *      skip canonicalisation — which is why the very first `mkdir`/`writeFile`
 *      succeeded and every read, stat and later mkdir was then refused.
 *   3. Android has no custom-protocol IPC, so `writeFile` ships the bytes across
 *      the JNI bridge as a JSON array of integers — roughly 3× the file size for
 *      a file that may already be 25 MB.
 */
import { platformKind } from '../platform';
import { QaError } from '../qa-error';

/** Desktop is the only platform on the Tauri fs path (see the note above). */
function usesTauriFs(): boolean {
  return platformKind() === 'desktop';
}

export async function putMedia(name: string, blob: Blob): Promise<void> {
  if (usesTauriFs()) return putMediaTauri(name, blob);
  return putMediaWeb(name, blob);
}

/**
 * A URL the background layer can render. OPFS returns a `blob:` object URL (the
 * caller revokes it); desktop returns a stable asset-protocol URL. `revokeObjectURL`
 * is a no-op on non-`blob:` URLs, so callers need no branch — and an object URL
 * made from an OPFS `File` is backed by the stored file rather than a heap copy,
 * so `<video>` still streams instead of buffering the whole clip.
 */
export async function mediaUrl(name: string): Promise<string> {
  if (usesTauriFs()) return mediaUrlTauri(name);
  return mediaUrlWeb(name);
}

export async function removeMedia(name: string): Promise<void> {
  if (usesTauriFs()) return removeMediaTauri(name);
  return removeMediaWeb(name);
}

export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if (usesTauriFs()) return estimateStorageTauri();
  const est = await navigator.storage.estimate();
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
}

// --- OPFS (web + Android) ---

/**
 * OPFS is typed as always-present but really can be missing — a pre-109 Chromium
 * WebView, or a browser in private mode, throws here. Translating that into a
 * typed error is what lets the UI say "storage unavailable" instead of blaming
 * the user's file (docs/06 §9).
 */
async function backgroundsDir(): Promise<FileSystemDirectoryHandle> {
  let root: FileSystemDirectoryHandle;
  try {
    root = await navigator.storage.getDirectory();
  } catch {
    throw new QaError('E_MEDIA_STORAGE', 'OPFS unavailable');
  }
  return root.getDirectoryHandle('backgrounds', { create: true });
}

async function putMediaWeb(name: string, blob: Blob): Promise<void> {
  const dir = await backgroundsDir();
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function mediaUrlWeb(name: string): Promise<string> {
  const dir = await backgroundsDir();
  const handle = await dir.getFileHandle(name);
  const file = await handle.getFile();
  return URL.createObjectURL(file);
}

async function removeMediaWeb(name: string): Promise<void> {
  const dir = await backgroundsDir();
  await dir.removeEntry(name);
}

// --- desktop (Tauri fs + asset protocol) ---

async function putMediaTauri(name: string, blob: Blob): Promise<void> {
  const { mkdir, writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  await mkdir('backgrounds', { baseDir: BaseDirectory.AppData, recursive: true });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await writeFile(`backgrounds/${name}`, bytes, { baseDir: BaseDirectory.AppData });
}

async function mediaUrlTauri(name: string): Promise<string> {
  const [{ convertFileSrc }, { appDataDir, join }] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/path'),
  ]);
  const path = await join(await appDataDir(), 'backgrounds', name);
  return convertFileSrc(path);
}

async function removeMediaTauri(name: string): Promise<void> {
  const { remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  await remove(`backgrounds/${name}`, { baseDir: BaseDirectory.AppData });
}

async function estimateStorageTauri(): Promise<{ usage: number; quota: number }> {
  const { readDir, stat, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  let usage = 0;
  try {
    const entries = await readDir('backgrounds', { baseDir: BaseDirectory.AppData });
    for (const entry of entries) {
      if (!entry.isFile) continue;
      const info = await stat(`backgrounds/${entry.name}`, { baseDir: BaseDirectory.AppData });
      usage += info.size;
    }
  } catch {
    // The backgrounds dir doesn't exist until the first write — treat as empty.
  }
  // No disk-quota API on native; report a large sentinel. The usage meter falls
  // back to the limits.ts file-count caps rather than a disk percentage.
  return { usage, quota: Number.MAX_SAFE_INTEGER };
}
