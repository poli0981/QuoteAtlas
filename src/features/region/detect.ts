/**
 * Region detection (docs/05 §6). Pure — inputs are injected so the boot layer
 * owns the impure reads (`Intl…timeZone`, `navigator.languages`). NO geolocation
 * anywhere (CLAUDE.md R1).
 */

export interface DetectInput {
  /** Intl.DateTimeFormat().resolvedOptions().timeZone */
  timeZone: string;
  /** navigator.languages */
  languages: readonly string[];
}

/** Region subtag of a BCP-47 tag: "vi-VN" → "VN", "zh-Hant-TW" → "TW", "en" → null. */
function regionFromLanguageTag(tag: string): string | null {
  for (const sub of tag.split('-').slice(1)) {
    if (/^[A-Za-z]{2}$/.test(sub)) return sub.toUpperCase();
    if (/^\d{3}$/.test(sub)) return sub; // UN M49 region code (e.g. es-419)
  }
  return null;
}

/**
 * Detect the user's country from timezone, falling back to the region subtag of
 * their first language. Returns null when neither yields a region (→ the caller
 * uses the language-only locale fallback chain, docs/03 §2).
 */
export function detect(tzMap: Record<string, string>, input: DetectInput): string | null {
  const fromTz = tzMap[input.timeZone];
  if (fromTz) return fromTz;
  for (const lang of input.languages) {
    const region = regionFromLanguageTag(lang);
    if (region) return region;
  }
  return null;
}
