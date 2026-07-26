import { afterEach, describe, expect, it } from 'vitest';
import { isTauri, platformKind } from './platform';

type Win = Record<string, unknown>;

const realUserAgent = navigator.userAgent;

function setUserAgent(ua: string): void {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

afterEach(() => {
  delete (window as unknown as Win).__TAURI_INTERNALS__;
  setUserAgent(realUserAgent);
});

describe('platform', () => {
  it('reports web when not running in Tauri', () => {
    expect(isTauri()).toBe(false);
    expect(platformKind()).toBe('web');
  });

  it('detects a Tauri (desktop) shell', () => {
    (window as unknown as Win).__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);
    expect(platformKind()).toBe('desktop');
  });

  it('detects the Android shell from the WebView user agent', () => {
    // Storage routing keys off this: 'android' takes the OPFS path, 'desktop'
    // the Tauri fs one (src/lib/storage/media-adapter.ts).
    (window as unknown as Win).__TAURI_INTERNALS__ = {};
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36',
    );
    expect(platformKind()).toBe('android');
  });

  it('does not mistake an Android user agent in a plain browser for the shell', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/131.0.0.0 Mobile Safari/537.36');
    expect(platformKind()).toBe('web');
  });
});
