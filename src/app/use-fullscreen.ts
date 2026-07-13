import { useCallback, useEffect, useState } from 'react';

/**
 * Web fullscreen toggle (docs/06 §8). Web uses the Fullscreen API; the desktop
 * (Tauri) `setFullscreen(true)` path — which hides the window chrome — lands in
 * Phase 3. Esc exits (handled natively by the browser).
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
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, []);

  return { isFullscreen, toggle };
}
