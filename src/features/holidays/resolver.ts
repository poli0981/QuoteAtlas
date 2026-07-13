/**
 * Holiday resolution & precedence (docs/05 §4).
 *
 * This module owns `holidayFilter` (imported by the quote engine) and the
 * rule/override-driven resolver. `lunar:M-D` rules are evaluated by the in-house
 * amlich module (UTC+7) — never by a library (CLAUDE.md R8).
 *
 * NOTE: layering the `date-holidays` library on top (per-country statutory rules
 * + a library-name→tag mapping) is a Phase 2 follow-up; v1.0's holidays (Tết,
 * mid-autumn, Hùng Kings, new-year) are all expressible as override rules here.
 */
import { convertLunar2Solar } from '../clock/calendars/amlich';
import type { QuoteRecord } from '../quote/types';
import type { HolidayOverride, HolidayTagRegistry, HolidayTags } from './types';

const LUNAR_PREFIX = 'lunar:';

function dayIndex(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Resolve a holiday rule to its solar (month, day) in a given year.
 * Supports `M-D` (fixed Gregorian) and `lunar:M-D` (VN lunar via amlich, UTC+7).
 * Returns null for malformed or non-existent (e.g. missing leap) rules.
 */
export function resolveRuleDate(rule: string, year: number): { m: number; d: number } | null {
  const isLunar = rule.startsWith(LUNAR_PREFIX);
  const body = isLunar ? rule.slice(LUNAR_PREFIX.length) : rule;
  const parts = body.split('-');
  if (parts.length !== 2) return null;
  const m = Number(parts[0]);
  const d = Number(parts[1]);
  if (!Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (!isLunar) return { m, d };

  const solar = convertLunar2Solar(d, m, year, false);
  if (solar.y === 0) return null;
  return { m: solar.m, d: solar.d };
}

/**
 * Resolve the holiday tags active on `date` for `country`, from the tag registry
 * and that country's override document. Multiple holidays on one day union their
 * tags at their respective precedence levels.
 */
export function resolve(
  date: { d: number; m: number; y: number },
  country: string,
  registry: HolidayTagRegistry,
  overrides: HolidayOverride | undefined,
): HolidayTags {
  const removed = new Set(overrides?.remove ?? []);
  const matched = new Set<string>();
  const cur = dayIndex(date.y, date.m, date.d);

  for (const entry of overrides?.add ?? []) {
    if (removed.has(entry.tag)) continue;
    const rd = resolveRuleDate(entry.rule, date.y);
    if (!rd) continue;
    const start = dayIndex(date.y, rd.m, rd.d);
    const span = entry.days ?? 1;
    if (cur >= start && cur < start + span) matched.add(entry.tag);
  }

  const national: string[] = [];
  const international: string[] = [];
  for (const tag of matched) {
    const def = registry[tag];
    if (!def) continue;
    if (def.scope === 'international') {
      international.push(tag);
    } else if (!def.countries || def.countries.includes(country)) {
      national.push(tag);
    }
  }
  return { national, international };
}

/**
 * Restrict a quote pool to today's holiday quotes, with precedence
 * national > international > full pool. Never returns an empty pool for a
 * non-empty input (docs/05 §4: never blank the screen).
 */
export function holidayFilter(pool: QuoteRecord[], tags: HolidayTags): QuoteRecord[] {
  if (tags.national.length > 0) {
    const n = pool.filter((q) => q.holidays.some((h) => tags.national.includes(h)));
    if (n.length > 0) return n;
  }
  if (tags.international.length > 0) {
    const i = pool.filter((q) => q.holidays.some((h) => tags.international.includes(h)));
    if (i.length > 0) return i;
  }
  return pool;
}
