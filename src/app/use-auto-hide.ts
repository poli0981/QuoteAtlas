import { useEffect, useState } from 'react';

/**
 * Returns false after `delayMs` of no pointer/keyboard activity, true again on
 * the next activity (docs/06 §1: the toolbar fades out after 3 s idle).
 */
export function useAutoHide(delayMs = 3000): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (): void => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setVisible(false);
      }, delayMs);
    };
    show();
    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, show, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, show);
    };
  }, [delayMs]);

  return visible;
}
