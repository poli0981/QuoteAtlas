/**
 * Which second calendar the clock shows for a region (docs/07 §4).
 *
 * Pure lookup — no DOM, no Intl call. The caller formats: Vietnam goes through
 * `calendars/amlich.ts`, everything else through `Intl.DateTimeFormat` with the
 * matching `-u-ca-` extension. A region with no entry shows no second line
 * rather than a Gregorian date twice.
 *
 * Vietnam is deliberately NOT `-u-ca-chinese`. That calendar computes at UTC+8
 * and puts Tết 1985 a full month away from the Vietnamese date, because the 1984
 * winter solstice fell 36 minutes either side of local midnight in the two zones
 * (CLAUDE.md R8, docs/05 §5).
 */

/** A calendar the clock can render as its second line. */
export type RegionalCalendar =
  | { kind: 'vn' }
  | {
      kind: 'intl';
      /** BCP-47 `-u-ca-` calendar key. */
      calendar:
        'chinese' | 'japanese' | 'dangi' | 'buddhist' | 'islamic-umalqura' | 'hebrew' | 'persian';
      /** Era/year-heavy calendars read better without a weekday. */
      era?: boolean;
    };

const CHINESE = ['CN', 'TW', 'HK', 'MO', 'SG', 'MY'];
const HIJRI = [
  'SA',
  'AE',
  'EG',
  'QA',
  'KW',
  'BH',
  'OM',
  'JO',
  'IQ',
  'LY',
  'MA',
  'DZ',
  'TN',
  'YE',
  'SD',
  'SY',
  'LB',
  'PS',
];

const BY_REGION = new Map<string, RegionalCalendar>([
  ['VN', { kind: 'vn' }],
  ...CHINESE.map((r): [string, RegionalCalendar] => [r, { kind: 'intl', calendar: 'chinese' }]),
  ['JP', { kind: 'intl', calendar: 'japanese', era: true }],
  ['KR', { kind: 'intl', calendar: 'dangi' }],
  ['TH', { kind: 'intl', calendar: 'buddhist', era: true }],
  ...HIJRI.map((r): [string, RegionalCalendar] => [
    r,
    { kind: 'intl', calendar: 'islamic-umalqura' },
  ]),
  ['IL', { kind: 'intl', calendar: 'hebrew' }],
  ['IR', { kind: 'intl', calendar: 'persian' }],
  ['AF', { kind: 'intl', calendar: 'persian' }],
]);

/** The regional calendar for a country code, or null to hide the line. */
export function calendarFor(region: string | null | undefined): RegionalCalendar | null {
  if (region == null) return null;
  return BY_REGION.get(region.toUpperCase()) ?? null;
}
