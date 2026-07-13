/**
 * Platform detection (docs/02 §4). Decided once at boot; features consume the
 * injected adapters rather than sniffing the platform inline.
 */

export type PlatformKind = 'web' | 'desktop' | 'android';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function platformKind(): PlatformKind {
  if (!isTauri()) return 'web';
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  return /android/i.test(ua) ? 'android' : 'desktop';
}
