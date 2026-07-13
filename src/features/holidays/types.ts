/** Holiday domain types — mirror of data/holidays/*.json (docs/04 §3). */

export type HolidayScope = 'national' | 'international';

export interface HolidayTagDef {
  scope: HolidayScope;
  /** required when scope = national */
  countries?: string[];
}

export type HolidayTagRegistry = Record<string, HolidayTagDef>;

/** Resolved holiday tags for a given day, split by precedence level (docs/05 §4). */
export interface HolidayTags {
  national: string[];
  international: string[];
}

/** A per-country override document (docs/04 §3). */
export interface HolidayOverride {
  country: string;
  add?: { tag: string; rule: string; days?: number }[];
  remove?: string[];
}
