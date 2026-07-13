/**
 * Region → locale fallback chain (docs/03 §2): region pool → primary language →
 * 'en' (always present, R4). `fallback` is true when a region was chosen but has
 * no native pool, so the UI can surface it (never silent).
 */
import type { LocaleIndex } from '../quote/types';

export interface LocaleResolution {
  locale: string;
  fallback: boolean;
}

export function resolveLocale(
  region: string | null,
  index: LocaleIndex,
  languages: readonly string[],
): LocaleResolution {
  if (region) {
    const byRegion = index.locales.find((l) => l.regions.includes(region));
    if (byRegion) return { locale: byRegion.code, fallback: false };
  }

  // Region has no native pool (or none chosen): try the primary language, then 'en'.
  let locale = 'en';
  for (const lang of languages) {
    const primary = lang.split('-')[0]?.toLowerCase();
    const byLang = primary
      ? index.locales.find((l) => l.code.toLowerCase() === primary)
      : undefined;
    if (byLang) {
      locale = byLang.code;
      break;
    }
  }
  return { locale, fallback: region !== null };
}

/** The set of regions that have a native pool (docs/06 §6 grouping). */
export function regionsWithPool(index: LocaleIndex): Set<string> {
  const set = new Set<string>();
  for (const l of index.locales) for (const r of l.regions) set.add(r);
  return set;
}
