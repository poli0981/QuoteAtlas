import { afterEach, describe, expect, it } from 'vitest';
import { isTauri, platformKind } from './platform';

type Win = Record<string, unknown>;

afterEach(() => {
  delete (window as unknown as Win).__TAURI_INTERNALS__;
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
});
