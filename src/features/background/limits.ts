/**
 * Media limits — the ONE place every media cap lives (CLAUDE.md R2, docs/04 §7).
 *
 * No literal cap value may appear anywhere else in the codebase (enforced by the
 * grep meta-test in limits.test.ts). Consumers read caps via `capsFor(profile)`.
 */

const MB = 1024 * 1024;

/** Long-edge boundary (px) separating the 1080p and 4K image classes. */
const P1080_MAX_EDGE = 1920;

export type MediaProfile = 'web' | 'desktop-android';

export interface MediaCaps {
  imageMaxFiles: number;
  imageMaxBytes1080: number;
  imageMaxBytes4k: number;
  imageMaxLongEdge: number;
  videoMaxFiles: number;
  videoMaxSeconds: number;
  videoToleranceSeconds: number;
  videoMaxBytes1080: number;
  videoMaxBytes4k: number;
  videoMaxHeight: number;
}

const WEB: MediaCaps = {
  imageMaxFiles: 25,
  imageMaxBytes1080: 10 * MB,
  imageMaxBytes4k: 25 * MB,
  imageMaxLongEdge: 3840,
  videoMaxFiles: 10,
  videoMaxSeconds: 180,
  videoToleranceSeconds: 2,
  videoMaxBytes1080: 50 * MB,
  videoMaxBytes4k: 125 * MB,
  videoMaxHeight: 2160,
};

const DESKTOP_ANDROID: MediaCaps = {
  ...WEB,
  imageMaxFiles: 40,
  videoMaxFiles: 20,
  videoMaxBytes4k: 150 * MB,
};

/** The media caps for a platform profile (docs/02 §4). */
export function capsFor(profile: MediaProfile): MediaCaps {
  return profile === 'web' ? WEB : DESKTOP_ANDROID;
}

export type ImageClass = 'P1080' | 'P4K' | 'OVERSIZE';

/** Classify an image by its longest edge (docs/03 §4). */
export function classifyImage(longEdge: number, caps: MediaCaps): ImageClass {
  if (longEdge <= P1080_MAX_EDGE) return 'P1080';
  if (longEdge <= caps.imageMaxLongEdge) return 'P4K';
  return 'OVERSIZE';
}

/** The byte cap for a (non-oversize) image class. */
export function imageCapBytes(klass: 'P1080' | 'P4K', caps: MediaCaps): number {
  return klass === 'P1080' ? caps.imageMaxBytes1080 : caps.imageMaxBytes4k;
}

/** The target long edge (px) to resize an image class down to during compression. */
export function targetEdge(klass: 'P1080' | 'P4K', caps: MediaCaps): number {
  return klass === 'P1080' ? P1080_MAX_EDGE : caps.imageMaxLongEdge;
}

/** Byte cap for a video by its height (docs/04 §7): ≤1080p vs 4K-class. */
export function videoCapBytes(height: number, caps: MediaCaps): number {
  return height <= 1080 ? caps.videoMaxBytes1080 : caps.videoMaxBytes4k;
}
