/**
 * Media file storage (docs/02 §4, docs/04 §6). Web uses OPFS
 * (`/backgrounds/<id>.<ext>`); desktop/Android use the Tauri fs plugin
 * (`$APPDATA/backgrounds/<id>.<ext>`) and serve files through the asset protocol.
 * Binaries never live in settings — only the index does. Tauri modules are loaded
 * via dynamic import inside the native branches so the web bundle stays Tauri-free.
 */
import { isTauri } from '../platform';

export async function putMedia(name: string, blob: Blob): Promise<void> {
  if (isTauri()) return putMediaTauri(name, blob);
  return putMediaWeb(name, blob);
}

/**
 * A URL the background layer can render. Web returns a `blob:` object URL (the
 * caller revokes it); native returns a stable asset-protocol URL. `revokeObjectURL`
 * is a no-op on non-`blob:` URLs, so callers need no branch — and `<video>` streams
 * the asset via HTTP range requests instead of buffering the whole file.
 */
export async function mediaUrl(name: string): Promise<string> {
  if (isTauri()) return mediaUrlTauri(name);
  return mediaUrlWeb(name);
}

export async function removeMedia(name: string): Promise<void> {
  if (isTauri()) return removeMediaTauri(name);
  return removeMediaWeb(name);
}

export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if (isTauri()) return estimateStorageTauri();
  const est = await navigator.storage.estimate();
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
}

// --- web (OPFS) ---

async function backgroundsDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
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

// --- native (Tauri fs + asset protocol) ---

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
