/**
 * The holiday rule grammar (docs/04 §3, docs/05 §4). Pure: a rule string plus a
 * year resolves to a Gregorian month/day, or null when the rule is malformed or
 * names a date that does not occur that year.
 *
 * | form          | means                                        | example        |
 * | ------------- | -------------------------------------------- | -------------- |
 * | `M-D`         | fixed Gregorian date                         | `12-25`        |
 * | `lunar:M-D`   | lunisolar date, in the region's own zone      | `lunar:1-1`    |
 * | `easter`      | Easter Sunday (Gregorian computus)           | `easter`       |
 * | `easter±N`    | N days from Easter                           | `easter-47`    |
 * | `nth:M-W-N`   | Nth weekday W of month M (W: 0=Sun…6=Sat)    | `nth:5-0-2`    |
 * | `last:M-W`    | last weekday W of month M                    | `last:5-1`     |
 * | `term:NAME`   | first day of a solar term (tiết khí / 節気)   | `term:qingming`|
 * | `term:NAME±N` | N days from a solar term                     | `term:lichun-1`|
 *
 * The offset forms are what make the grammar cover holidays that are *defined*
 * relative to something else rather than by a date: Shrove Tuesday is Easter − 47
 * and setsubun is the day before lập xuân, and writing them as fixed dates would
 * be wrong in most years.
 */
import { convertLunar2Solar, solarTermDate } from '../clock/calendars/amlich';

export interface RuleDate {
  m: number;
  d: number;
}

const LUNAR = 'lunar:';
const EASTER = 'easter';
const NTH = 'nth:';
const LAST = 'last:';
const TERM = 'term:';

/**
 * Ecliptic longitude of each solar term the data uses. The 24 terms are every
 * 15° starting from lập xuân at 315°; only the named ones are listed, because an
 * unnamed term is a typo rather than a holiday.
 */
const TERM_LONGITUDE: Record<string, number> = {
  lichun: 315, // 立春 lập xuân — start of spring; setsubun is the day before
  chunfen: 0, //  春分 xuân phân — vernal equinox
  qingming: 15, // 清明 thanh minh — tomb-sweeping
  xiazhi: 90, //   夏至 hạ chí — summer solstice
  qiufen: 180, //  秋分 thu phân — autumnal equinox
  dongzhi: 270, // 冬至 đông chí — winter solstice
};

/**
 * Which zone a region's lunisolar dates and solar terms are reckoned in.
 *
 * This is not cosmetic. A new moon or a term crossing minutes either side of
 * local midnight lands on different days in different zones — the reason Tết and
 * 春节 fall a day apart in 1968 and 2007 (CLAUDE.md R8). Resolving China's 春节
 * at Vietnam's UTC+7 would put it on the wrong day in exactly those years.
 */
const LUNAR_ZONE: Record<string, number> = {
  VN: 7,
  CN: 8,
  TW: 8,
  HK: 8,
  MO: 8,
  SG: 8,
  MY: 8,
  KR: 9,
  JP: 9,
};

/** The zone a country's lunisolar dates are reckoned in; UTC+7 (Vietnam) by default. */
export function lunarZoneFor(country: string): number {
  return LUNAR_ZONE[country.toUpperCase()] ?? 7;
}

/** Gregorian Easter Sunday (Meeus/Butcher computus). Western, not Orthodox. */
export function easterDate(year: number): RuleDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return { m: Math.floor(n / 31), d: (n % 31) + 1 };
}

/** Nth (1-based) weekday `weekday` of a month, or null if the month has fewer. */
export function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  n: number,
): RuleDate | null {
  if (n < 1) return null;
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - firstDow + 7) % 7) + (n - 1) * 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day > daysInMonth ? null : { m: month, d: day };
}

/** Last `weekday` of a month — always exists, unlike the 5th. */
export function lastWeekday(year: number, month: number, weekday: number): RuleDate {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDow = new Date(Date.UTC(year, month - 1, daysInMonth)).getUTCDay();
  return { m: month, d: daysInMonth - ((lastDow - weekday + 7) % 7) };
}

/** Shift a Gregorian date by whole days, rolling across month and year edges. */
function shift(date: RuleDate, year: number, days: number): RuleDate {
  const t = Date.UTC(year, date.m - 1, date.d) + days * 86400000;
  const dt = new Date(t);
  return { m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Split a trailing `+N` / `-N` offset off a rule body. */
function splitOffset(body: string): { head: string; offset: number } | null {
  const at = Math.max(body.lastIndexOf('+'), body.lastIndexOf('-'));
  if (at <= 0) return { head: body, offset: 0 };
  const offset = Number(body.slice(at));
  if (!Number.isInteger(offset)) return null;
  return { head: body.slice(0, at), offset };
}

/** Parse `A-B` / `A-B-C` into integers, or null if any part is not one. */
function ints(body: string, count: number): number[] | null {
  const parts = body.split('-');
  if (parts.length !== count) return null;
  const out = parts.map(Number);
  return out.every((n) => Number.isInteger(n)) ? out : null;
}

/**
 * Range-check a month/day pair.
 *
 * Not pedantry: `convertLunar2Solar` happily computes an answer for month 13 —
 * it derives an offset from month 11 and never asks whether the month exists —
 * so `lunar:13-1` would resolve to a real-looking but meaningless date. The
 * schema pattern cannot catch it either, since it only constrains digits.
 */
function inRange(m: number, d: number, maxDay: number): boolean {
  return m >= 1 && m <= 12 && d >= 1 && d <= maxDay;
}

/**
 * Resolve a rule to its Gregorian month/day in `year`.
 *
 * `zone` is the region's lunisolar zone (see `lunarZoneFor`) and is used by both
 * `lunar:` and `term:` — the two forms whose answer depends on where local
 * midnight falls.
 */
export function resolveRule(rule: string, year: number, zone: number): RuleDate | null {
  if (rule.startsWith(LUNAR)) {
    const parts = ints(rule.slice(LUNAR.length), 2);
    if (!parts) return null;
    const [m, d] = parts as [number, number];
    // A lunar month has at most 30 days.
    if (!inRange(m, d, 30)) return null;
    const solar = convertLunar2Solar(d, m, year, false, zone);
    // y === 0 is amlich's "that leap month does not exist this year".
    return solar.y === 0 ? null : { m: solar.m, d: solar.d };
  }

  if (rule.startsWith(NTH)) {
    const parts = ints(rule.slice(NTH.length), 3);
    if (!parts) return null;
    const [m, w, n] = parts as [number, number, number];
    if (m < 1 || m > 12 || w < 0 || w > 6) return null;
    return nthWeekday(year, m, w, n);
  }

  if (rule.startsWith(LAST)) {
    const parts = ints(rule.slice(LAST.length), 2);
    if (!parts) return null;
    const [m, w] = parts as [number, number];
    if (m < 1 || m > 12 || w < 0 || w > 6) return null;
    return lastWeekday(year, m, w);
  }

  if (rule.startsWith(TERM)) {
    const split = splitOffset(rule.slice(TERM.length));
    if (!split) return null;
    const deg = TERM_LONGITUDE[split.head];
    if (deg === undefined) return null;
    const term = solarTermDate(deg, year, zone);
    if (!term) return null;
    return split.offset === 0
      ? { m: term.m, d: term.d }
      : shift({ m: term.m, d: term.d }, year, split.offset);
  }

  if (rule === EASTER || rule.startsWith(`${EASTER}+`) || rule.startsWith(`${EASTER}-`)) {
    const split = splitOffset(rule);
    if (split?.head !== EASTER) return null;
    const easter = easterDate(year);
    return split.offset === 0 ? easter : shift(easter, year, split.offset);
  }

  const parts = ints(rule, 2);
  if (!parts) return null;
  const [m, d] = parts as [number, number];
  return inRange(m, d, 31) ? { m, d } : null;
}
