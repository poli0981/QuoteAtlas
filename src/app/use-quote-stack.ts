import { useCallback, useEffect, useRef, useState } from 'react';
import type { HolidayTags } from '../features/holidays/types';
import { select } from '../features/quote/engine';
import type { QuoteMode, QuoteRecord } from '../features/quote/types';

/** cap the session stack so a long rotate session doesn't grow unbounded */
const STACK_CAP = 100;

function dateKeyNow(): string {
  const now = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
}

export interface QuoteNav {
  quote: QuoteRecord | null;
  goPrev: () => void;
  goNext: () => void;
  canPrev: boolean;
}

/**
 * Session-stack quote navigation (docs/05 §2): prev/next walk the stack of
 * shown quotes without re-picking; reaching the end (or rotate ticking) picks a
 * fresh quote via the engine, which owns the anti-repeat ring.
 */
export function useQuoteStack(params: {
  pool: QuoteRecord[];
  mode: QuoteMode;
  locale: string;
  rotateSeconds: number;
  holidayTags: HolidayTags;
}): QuoteNav {
  const { pool, mode, locale, rotateSeconds, holidayTags } = params;
  const [nav, setNav] = useState<{ stack: QuoteRecord[]; pos: number }>({ stack: [], pos: -1 });
  const historyRef = useRef<string[]>([]);

  const pickNew = useCallback((): void => {
    const result = select({
      pool,
      mode,
      history: historyRef.current,
      holidayTags,
      locale,
      dateKey: dateKeyNow(),
    });
    if (!result) return;
    historyRef.current = result.history;
    setNav((n) => {
      const stack = [...n.stack, result.quote].slice(-STACK_CAP);
      return { stack, pos: stack.length - 1 };
    });
  }, [pool, mode, locale, holidayTags]);

  useEffect(() => {
    // (re)start the session on locale/mode change; rotate advances on a timer
    historyRef.current = [];
    setNav({ stack: [], pos: -1 });
    pickNew();
    if (mode === 'rotate') {
      const id = setInterval(pickNew, rotateSeconds * 1000);
      return () => {
        clearInterval(id);
      };
    }
    return undefined;
  }, [pickNew, mode, rotateSeconds]);

  const goPrev = useCallback((): void => {
    setNav((n) => ({ ...n, pos: Math.max(0, n.pos - 1) }));
  }, []);

  const goNext = useCallback((): void => {
    if (nav.pos < nav.stack.length - 1) {
      setNav((n) => ({ ...n, pos: n.pos + 1 }));
    } else {
      pickNew();
    }
  }, [nav, pickNew]);

  return {
    quote: nav.stack[nav.pos] ?? null,
    goPrev,
    goNext,
    canPrev: nav.pos > 0,
  };
}
