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
  const merged: HolidayOverride = {
    country,
    add: [...INTL_ADDS, ...(own?.add ?? [])],
    ...(own?.remove ? { remove: own.remove } : {}),
  };
  return resolve(
    { d: date.getDate(), m: date.getMonth() + 1, y: date.getFullYear() },
    country,
    REGISTRY,
    merged,
  );
}
