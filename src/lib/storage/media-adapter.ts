/**
 * Media file storage (docs/02 §4, docs/04 §6). Web uses OPFS
 * (`/backgrounds/<id>.<ext>`); desktop/Android switch to the Tauri fs plugin in
 * Phase 3 (same interface). Binaries never live in settings — only the index does.
 */

async function backgroundsDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('backgrounds', { create: true });
}

export async function putMedia(name: string, blob: Blob): Promise<void> {
  const dir = await backgroundsDir();
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/** Object URL for a stored file (caller revokes it). */
export async function mediaUrl(name: string): Promise<string> {
  const dir = await backgroundsDir();
  const handle = await dir.getFileHandle(name);
  const file = await handle.getFile();
  return URL.createObjectURL(file);
}

export async function removeMedia(name: string): Promise<void> {
  const dir = await backgroundsDir();
  await dir.removeEntry(name);
}

export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  const est = await navigator.storage.estimate();
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
}
