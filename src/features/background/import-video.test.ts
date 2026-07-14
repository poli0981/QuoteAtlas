import { describe, expect, it, vi } from 'vitest';
import { importVideo } from './import-video';
import { capsFor } from './limits';

/**
 * A file that *reports* a huge size without allocating one, and that BLOWS UP if
 * anything tries to read it whole — only the 16-byte magic-number slice is served.
 * (jsdom's Blob has no arrayBuffer(), so this is a stub rather than a real File.)
 */
function hugeWebm(bytes: number): { file: File; readWholeFile: ReturnType<typeof vi.fn> } {
  const head = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...new Array<number>(12).fill(0)]);
  const readWholeFile = vi.fn(() => Promise.reject(new Error('read the whole file')));
  const file = {
    name: 'huge.webm',
    type: 'video/webm',
    size: bytes,
    slice: () => ({ arrayBuffer: () => Promise.resolve(head.buffer) }),
    arrayBuffer: readWholeFile,
  };
  return { file: file as unknown as File, readWholeFile };
}

describe('importVideo — memory discipline', () => {
  it('rejects an over-cap video on size alone, without ever hashing it', async () => {
    // Regression (docs/04 §7): dedup used to hash the picked file eagerly, pulling
    // the WHOLE thing into the JS heap before any cap check. Picking an unedited 4K
    // phone clip therefore allocated ~1 GB (plus a digest copy) purely in order to
    // reject it — and past V8's max ArrayBuffer that read throws, which the UI
    // surfaced as "unsupported file type" instead of "video over the size limit".
    // A video's bytes must never reach the heap: `size` alone decides this.
    const caps = capsFor('web');
    const hashFile = vi.fn<() => Promise<string>>();
    const { file, readWholeFile } = hugeWebm(caps.videoMaxBytes4k + 1);

    const result = await importVideo(file, 'web', [], hashFile);

    expect(result).toEqual({ ok: false, reason: 'size' });
    expect(hashFile).not.toHaveBeenCalled();
    expect(readWholeFile).not.toHaveBeenCalled();
  });
});
