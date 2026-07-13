/**
 * Quote selection & anti-repeat (docs/05 §2, docs/03 §3).
 *
 * Pure: no DOM/Tauri. `daily` mode is stable for the whole local day and differs
 * per locale; `per-load`/`rotate` use an injected (or default) RNG. Anti-repeat
 * keeps a ring of the last ids; the ring clears rather than blank the screen.
 */
import { hashSeed, mulberry32 } from '../../lib/prng';
import { holidayFilter } from '../holidays/resolver';
import type { HolidayTags } from '../holidays/types';
import type { QuoteMode, QuoteRecord } from './types';

const HISTORY_MAX = 50;

export interface SelectContext {
  pool: QuoteRecord[];
  mode: QuoteMode;
  /** ring of recently shown ids (most recent last) */
  history: string[];
  holidayTags: HolidayTags;
  locale: string;
  /** yyyymmdd of the local civil day — the daily-mode seed component */
  dateKey: string;
  /** injected RNG for per-load/rotate and tests; ignored in daily mode */
  rng?: () => number;
}

export interface SelectResult {
  quote: QuoteRecord;
  /** updated history ring (immutable — caller persists it) */
  history: string[];
}

function defaultRng(): () => number {
  return mulberry32((Math.random() * 0x100000000) >>> 0);
}

/** Select one quote from the pool for the current context. Null iff the pool is empty. */
export function select(ctx: SelectContext): SelectResult | null {
  const filtered = holidayFilter(ctx.pool, ctx.holidayTags);
  if (filtered.length === 0) return null;

  const seen = new Set(ctx.history);
  let history = ctx.history;
  let candidates = filtered.filter((q) => !seen.has(q.id));
  if (candidates.length === 0) {
    history = [];
    candidates = filtered;
  }

  const rng =
    ctx.mode === 'daily'
      ? mulberry32(hashSeed(`${ctx.dateKey}|${ctx.locale}|qa`))
      : (ctx.rng ?? defaultRng());

  const quote = candidates[Math.floor(rng() * candidates.length)];
  if (!quote) return null; // unreachable (candidates is non-empty) — satisfies the type

  const nextHistory = [...history, quote.id];
  if (nextHistory.length > HISTORY_MAX) {
    nextHistory.splice(0, nextHistory.length - HISTORY_MAX);
  }
  return { quote, history: nextHistory };
}
