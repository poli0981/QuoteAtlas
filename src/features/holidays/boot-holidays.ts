/**
 * Resolves the holiday tags active today for the effective region, wiring the
 * (already-tested) resolver into boot (docs/03 §1, §3). Per-country override
 * files are auto-discovered; international rules are merged in for every country.
 *
 * Lunar rules resolve via amlich, which is anchor-validated (Tết dates pass);
 * R8's "not in UI until the full fixture is verified" is about the Clock's lunar
 * DATE line, not holiday-date resolution.
 */
import intlData from '../../../data/holidays/international.json';
import tagsData from '../../../data/holidays/tags.json';
import { resolve } from './resolver';
import type { HolidayOverride, HolidayTagRegistry, HolidayTags } from './types';

const REGISTRY = tagsData as HolidayTagRegistry;
const INTL_ADDS = (intlData as { add: NonNullable<HolidayOverride['add']> }).add;

const overrideMods = import.meta.glob<{ default: HolidayOverride }>(
  '../../../data/holidays/overrides/*.json',
  { eager: true },
);
const OVERRIDES: Record<string, HolidayOverride> = {};
for (const mod of Object.values(overrideMods)) {
  OVERRIDES[mod.default.country] = mod.default;
}

/** Holiday tags active on `date` for `country` (national + international levels). */
export function resolveActiveHolidays(date: Date, country: string | null): HolidayTags {
  if (!country) return { national: [], international: [] };
  const own = OVERRIDES[country];
  const ownTags = new Set((own?.add ?? []).map((a) => a.tag));
  const merged: HolidayOverride = {
    country,
    // A country's own entry SHADOWS the international one for the same tag,
    // rather than adding a second date for it. Britain's Mothering Sunday is
    // Easter − 21, not the second Sunday of May; without shadowing, a British
    // user would get "mothers-day" twice a year. `remove` cannot express this —
    // it drops the tag everywhere, including the country's own replacement.
    add: [...INTL_ADDS.filter((a) => !ownTags.has(a.tag)), ...(own?.add ?? [])],
    ...(own?.remove ? { remove: own.remove } : {}),
  };
  return resolve(
    { d: date.getDate(), m: date.getMonth() + 1, y: date.getFullYear() },
    country,
    REGISTRY,
    merged,
  );
}
