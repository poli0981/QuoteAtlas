/**
 * Image compression ladder (docs/05 §7).
 *
 * The pure ladder logic lives here (unit-tested with a mock encoder). The DOM
 * wiring — decode via `createImageBitmap`, resize on an `OffscreenCanvas`, encode
 * with `convertToBlob('image/webp')` inside a Worker, with a Safari WebP-encode
 * feature-check (docs/11 §4) — is a thin adapter layered on top in Phase 2.
 */
import { QaError } from '../../lib/qa-error';

/** WebP quality steps tried in order until the blob fits under the cap. */
export const WEBP_QUALITY_LADDER = [0.8, 0.72, 0.65, 0.6] as const;

export interface CompressResult {
  blob: Blob;
  quality: number;
}

/**
 * Encode with successively lower WebP quality until the result is within
 * `capBytes`. Throws `E_MEDIA_UNCOMPRESSIBLE` if even the lowest step is too big.
 */
export async function compressViaLadder(
  encode: (quality: number) => Promise<Blob>,
  capBytes: number,
): Promise<CompressResult> {
  for (const quality of WEBP_QUALITY_LADDER) {
    const blob = await encode(quality);
    if (blob.size <= capBytes) return { blob, quality };
  }
  throw new QaError('E_MEDIA_UNCOMPRESSIBLE');
}
