import { useCallback, useEffect, useState } from 'react';
import { platformKind } from '../lib/platform';

/**
 * Fullscreen toggle (docs/06 §8).
 *
 * Two different mechanisms, because the web one is not enough on desktop: the
 * Fullscreen API makes the *document* fill the webview, but the webview is inside
 * a native window whose title bar and borders stay put. Only
 * `setFullscreen(true)` removes those, which is what an ambient display needs.
 *
 * Android keeps the web path — there is no window chrome to hide — and the
 * `desktop` capability that grants `core:window:*` is not even granted there.
 *
 * Esc exits the web one natively; on desktop the toggle is the way back out.
 */
export function useFullscreen(): { isFullscreen: boolean; toggle: () => void } {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = (): void => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);

  const toggle = useCallback((): void => {
    if (platformKind() === 'desktop') {
      // Dynamic import so the web bundle stays Tauri-free (docs/02 §4). The
      // native window has no `fullscreenchange` event, so state is tracked here
      // rather than by the listener above.
      void (async () => {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const win = getCurrentWindow();
          const next = !(await win.isFullscreen());
          await win.setFullscreen(next);
          setIsFullscreen(next);
        } catch {
          // A refused permission or a missing window must not take the app down;
          // the button simply does nothing.
        }
      })();
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, []);

  return { isFullscreen, toggle };
}
