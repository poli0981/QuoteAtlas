/**
 * Holiday resolution & precedence (docs/05 §4).
 *
 * This module owns `holidayFilter` (imported by the quote engine) and the
 * override-driven resolver; the rule grammar itself lives in `rules.ts`.
 * Lunisolar rules are evaluated by the in-house amlich module — never by a
 * library (CLAUDE.md R8) — in the region's OWN zone, so 春节 in China is not
 * computed at Vietnam's UTC+7.
 *
 * NOTE: layering the `date-holidays` library on top (per-country statutory rules
 * + a library-name→tag mapping) is a Phase 2 follow-up; the holidays shipped so
 * far are all expressible as override rules here.
 */
import type { QuoteRecord } from '../quote/types';
import { lunarZoneFor, resolveRule, type RuleDate } from './rules';
import type { HolidayOverride, HolidayTagRegistry, HolidayTags } from './types';

function dayIndex(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Resolve a holiday rule to its Gregorian (month, day) in a given year, for a
 * country. Null for a malformed rule, or one naming a date that does not occur
 * that year (a missing leap month, a 5th Monday in a month with four).
 *
 * See `rules.ts` for the grammar.
 */
export function resolveRuleDate(rule: string, year: number, country = 'VN'): RuleDate | null {
  return resolveRule(rule, year, lunarZoneFor(country));
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
  const zone = lunarZoneFor(country);

  for (const entry of overrides?.add ?? []) {
    if (removed.has(entry.tag)) continue;
    // Resolve in the PREVIOUS year too: a rule can land in late December and run
    // into January (Tết's 5-day span never does, but `12-31` with days: 2 does,
    // and so would a lunar rule that slips across the boundary).
    for (const y of [date.y, date.y - 1]) {
      const rd = resolveRule(entry.rule, y, zone);
      if (!rd) continue;
      const start = dayIndex(y, rd.m, rd.d);
      const span = entry.days ?? 1;
      if (cur >= start && cur < start + span) {
        matched.add(entry.tag);
        break;
      }
    }
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
