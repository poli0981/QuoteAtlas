/**
 * Transforms the authored Markdown dataset in `content-src/` into the QuoteAtlas
 * JSON data pools (docs/04). Deterministic + idempotent: stable QuoteAtlas ids are
 * assigned via `data/quotes/id-map.json` (append-only, R12) so re-runs never
 * renumber. Output must pass `npm run validate:data`.
 *
 * Groups (see content-src/00-SCHEMA.md):
 *  - A  international holidays  → 6-locale explode, anchored on a holiday tag
 *  - B  native proverbs        → one locale only (CN → zh-Hans + zh-Hant), no
 *                                translations ("native only"), anchored on a tag
 *  - C  inspirational quotes    → 6-locale explode, anchored on a theme tag
 *
 * Holiday phasing (docs/05 §4): every quote is imported and tagged, but a holiday
 * rule is emitted ONLY when it is expressible as `M-D` / `lunar:M-D` (the resolver
 * grammar). Easter/computus, nth-weekday (Mother's/Father's/Thanksgiving), Pancake
 * (Easter-relative) and solar-term (Setsubun/Qingming) holidays are DEFERRED: their
 * tag is registered but no rule fires until the resolver grammar is extended, so
 * those quotes simply stay in the general pool.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'content-src');
const DATA = join(ROOT, 'data');
const QUOTES = join(DATA, 'quotes');
const OVERRIDES = join(DATA, 'holidays', 'overrides');

const LOCALES = ['en', 'vi', 'ja', 'ko', 'zh-Hans', 'zh-Hant'] as const;
type Locale = (typeof LOCALES)[number];

// ---------------------------------------------------------------------------
// CONFIG (human-owned tables — see content-src/00-SCHEMA.md §6/§7/§13)
// ---------------------------------------------------------------------------

const LOCALE_REGIONS: Record<Locale, string[]> = {
  en: ['US', 'GB', 'AU', 'CA', 'NZ', 'IE'],
  vi: ['VN'],
  ja: ['JP'],
  ko: ['KR'],
  'zh-Hans': ['CN'],
  'zh-Hant': ['TW', 'HK'],
};

const FONT_KEY: Record<Locale, string> = {
  en: 'serif',
  vi: 'serif',
  ja: 'serif-jp',
  ko: 'serif-kr',
  'zh-Hans': 'serif-sc',
  'zh-Hant': 'serif-tc',
};

/** Group B country → its native locale + the region(s) those proverbs belong to. */
const B_LOCALE_HEADING: Record<string, Locale[]> = {
  en: ['en'], // UK
  vi: ['vi'],
  ja: ['ja'],
  ko: ['ko'],
  zh: ['zh-Hans', 'zh-Hant'], // both scripts of the shared Han pool
};
const B_REGIONS: Record<Locale, string[]> = {
  en: ['GB'], // Group B "en" is UK-specific
  vi: ['VN'],
  ja: ['JP'],
  ko: ['KR'],
  'zh-Hans': ['CN'],
  'zh-Hant': ['TW', 'HK'],
};

/** source holiday_id → QuoteAtlas tag (distinct per culture; docs schema §7). */
const HOLIDAY_TAG: Record<string, string> = {
  'int.new_year': 'new-year',
  'int.valentine': 'valentine',
  'int.womens_day': 'womens-day',
  'int.easter': 'easter',
  'int.mothers_day': 'mothers-day',
  'int.fathers_day': 'fathers-day',
  'int.halloween': 'halloween',
  'int.thanksgiving': 'thanksgiving',
  'int.christmas': 'christmas',
  'int.nye': 'new-year-eve',
  'uk.burns_night': 'burns-night',
  'uk.pancake_day': 'pancake-day',
  'uk.st_george': 'st-georges-day',
  'uk.bonfire_night': 'bonfire-night',
  'uk.boxing_day': 'boxing-day',
  'vn.tet_nguyen_dan': 'tet',
  'vn.tet_han_thuc': 'tet-han-thuc',
  'vn.gio_to_hung_vuong': 'hung-kings',
  'vn.tet_doan_ngo': 'tet-doan-ngo',
  'vn.vu_lan': 'vu-lan',
  'vn.tet_trung_thu': 'trung-thu',
  'vn.ong_tao': 'ong-cong-ong-tao',
  'jp.oshogatsu': 'oshogatsu',
  'jp.setsubun': 'setsubun',
  'jp.hinamatsuri': 'hinamatsuri',
  'jp.kodomo_no_hi': 'kodomo-no-hi',
  'jp.tanabata': 'tanabata',
  'jp.obon': 'obon',
  'jp.tsukimi': 'tsukimi',
  'kr.seollal': 'seollal',
  'kr.daeboreum': 'daeboreum',
  'kr.dano': 'dano',
  'kr.chuseok': 'chuseok',
  'kr.hangul_day': 'hangul-day',
  'cn.chunjie': 'chunjie',
  'cn.yuanxiao': 'yuanxiao',
  'cn.qingming': 'qingming',
  'cn.duanwu': 'duanwu',
  'cn.qixi': 'qixi',
  'cn.zhongqiu': 'zhongqiu',
  'cn.chongyang': 'chongyang',
};

interface TagMeta {
  scope: 'national' | 'international';
  countries?: string[];
  /** M-D or lunar:M-D; omitted ⇒ deferred (registered but never fires). */
  rule?: string;
  days?: number;
}

const TAG_META: Record<string, TagMeta> = {
  // International — fixed Gregorian (rule emitted)
  'new-year': { scope: 'international', rule: '1-1' },
  valentine: { scope: 'international', rule: '2-14' },
  'womens-day': { scope: 'international', rule: '3-8' },
  halloween: { scope: 'international', rule: '10-31' },
  christmas: { scope: 'international', rule: '12-25' },
  'new-year-eve': { scope: 'international', rule: '12-31' },
  // International — deferred (computus / nth-weekday)
  easter: { scope: 'international' },
  'mothers-day': { scope: 'international' },
  'fathers-day': { scope: 'international' },
  thanksgiving: { scope: 'international' },
  // UK (GB)
  'burns-night': { scope: 'national', countries: ['GB'], rule: '1-25' },
  'pancake-day': { scope: 'national', countries: ['GB'] }, // deferred (Easter-47)
  'st-georges-day': { scope: 'national', countries: ['GB'], rule: '4-23' },
  'bonfire-night': { scope: 'national', countries: ['GB'], rule: '11-5' },
  'boxing-day': { scope: 'national', countries: ['GB'], rule: '12-26' },
  // Vietnam (lunar via amlich, UTC+7)
  tet: { scope: 'national', countries: ['VN'], rule: 'lunar:1-1', days: 5 },
  'tet-han-thuc': { scope: 'national', countries: ['VN'], rule: 'lunar:3-3' },
  'hung-kings': { scope: 'national', countries: ['VN'], rule: 'lunar:3-10' },
  'tet-doan-ngo': { scope: 'national', countries: ['VN'], rule: 'lunar:5-5' },
  'vu-lan': { scope: 'national', countries: ['VN'], rule: 'lunar:7-15' },
  'trung-thu': { scope: 'national', countries: ['VN'], rule: 'lunar:8-15' },
  'ong-cong-ong-tao': { scope: 'national', countries: ['VN'], rule: 'lunar:12-23' },
  // Japan
  oshogatsu: { scope: 'national', countries: ['JP'], rule: '1-1' },
  setsubun: { scope: 'national', countries: ['JP'] }, // deferred (solar term)
  hinamatsuri: { scope: 'national', countries: ['JP'], rule: '3-3' },
  'kodomo-no-hi': { scope: 'national', countries: ['JP'], rule: '5-5' },
  tanabata: { scope: 'national', countries: ['JP'], rule: '7-7' },
  obon: { scope: 'national', countries: ['JP'], rule: '8-13', days: 3 },
  tsukimi: { scope: 'national', countries: ['JP'], rule: 'lunar:8-15' },
  // Korea (lunar via amlich — ±1-day edge caveat accepted; tz-aware lunar is B-code)
  seollal: { scope: 'national', countries: ['KR'], rule: 'lunar:1-1' },
  daeboreum: { scope: 'national', countries: ['KR'], rule: 'lunar:1-15' },
  dano: { scope: 'national', countries: ['KR'], rule: 'lunar:5-5' },
  chuseok: { scope: 'national', countries: ['KR'], rule: 'lunar:8-15' },
  'hangul-day': { scope: 'national', countries: ['KR'], rule: '10-9' },
  // Greater China (shared by CN/TW/HK; lunar via amlich, same caveat)
  chunjie: { scope: 'national', countries: ['CN', 'TW', 'HK'], rule: 'lunar:1-1' },
  yuanxiao: { scope: 'national', countries: ['CN', 'TW', 'HK'], rule: 'lunar:1-15' },
  qingming: { scope: 'national', countries: ['CN', 'TW', 'HK'] }, // deferred (solar term)
  duanwu: { scope: 'national', countries: ['CN', 'TW', 'HK'], rule: 'lunar:5-5' },
  qixi: { scope: 'national', countries: ['CN', 'TW', 'HK'], rule: 'lunar:7-7' },
  zhongqiu: { scope: 'national', countries: ['CN', 'TW', 'HK'], rule: 'lunar:8-15' },
  chongyang: { scope: 'national', countries: ['CN', 'TW', 'HK'], rule: 'lunar:9-9' },
};

/** Group C source ids whose ORIGINAL language is Chinese (docs schema §13): the zh
 * columns are the classical original, so zh-* carry public-domain rights and the
 * other locales are our own translations. Human-reviewable. */
const ORIGIN_ZH = new Set([
  'INS-COURAGE-06', // Confucius, Analects 2:24
  'INS-WISDOM-02', // Lao Tzu, Tao Te Ching 33
  'INS-WISDOM-03', // Confucius, Analects
  'INS-LEARNING-01', // Confucius, Analects 2:15
  'INS-HAPPINESS-07', // Lao Tzu, Tao Te Ching 44
  'INS-CHARACTER-08', // Confucius, Analects 4:24
]);

/** Proverb source label per locale (Group B natives with no explicit source). */
const PROVERB_LABEL: Record<Locale, string> = {
  en: 'English proverb',
  vi: 'Tục ngữ Việt Nam',
  ja: '日本のことわざ',
  ko: '한국 속담',
  'zh-Hans': '中国谚语',
  'zh-Hant': '中國諺語',
};

/** Phrases that mark a Group A/B source as anonymous folk (→ proverb, no author). */
const GENERIC_SOURCE =
  /(proverb|traditional|\bfolk\b|scots|gaelic|cornish|nursery|rhyme|shroving|scripture|\blatin\b|khẩu hiệu|truyền thống|paschal|celtic|jewish|spanish|french|german|middle english|children|\bsignal\b|\btoast\b|blessing|\bcall\b|simile|ことわざ|四字熟語|慣用句|挨拶|掛け声|呼称|俗信|속담|인사말|속신|세시풍속|俗语|俗語|谚语|諺語|农谚|農諺|民谣|民謠|吉语|吉語|吉祥|对联|對聯|고전|세시)/i;
const BIBLE_REF =
  /^(genesis|exodus|leviticus|numbers|deuteronomy|psalms?|proverbs|ecclesiastes|isaiah|matthew|mark|luke|john|acts|romans|corinthians)\b/i;

// ---------------------------------------------------------------------------
// Markdown table parsing
// ---------------------------------------------------------------------------

interface Section {
  locale: string | null; // from a `# … \`locale: xx\`` heading (Group B)
  anchor: string; // holiday_id, or "theme: xxx", or ""
  header: string[];
  rows: string[][];
}

function splitCells(line: string): string[] {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return t.split('|').map((c) => c.trim());
}

function parseSections(md: string): Section[] {
  const lines = md.split(/\r?\n/);
  const sections: Section[] = [];
  let locale: string | null = null;
  let anchor = '';
  let header: string[] | null = null;
  let rows: string[][] = [];

  const flush = (): void => {
    if (header) sections.push({ locale, anchor, header, rows });
    header = null;
    rows = [];
  };

  for (const line of lines) {
    const backtick = /`([^`]+)`/.exec(line);
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      flush();
      const tok = backtick?.[1] ?? '';
      locale = tok.startsWith('locale:') ? tok.slice('locale:'.length).trim() : locale;
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      anchor = backtick?.[1] ?? '';
      continue;
    }
    if (line.trim().startsWith('|')) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue; // separator row
      const cells = splitCells(line);
      if (!header) header = cells;
      else rows.push(cells);
      continue;
    }
    // a blank/other line ends a table but keeps the section anchor
    if (line.trim() === '' && header) flush();
  }
  flush();
  return sections;
}

// ---------------------------------------------------------------------------
// Attribution parsing
// ---------------------------------------------------------------------------

interface Attribution {
  work: string | null;
  character: null;
  actor: null;
  author: string | null;
  developer: null;
  publisher: null;
  source: string | null;
  year: number | null;
  links: { work?: string; author?: string };
  rights: 'public-domain' | 'quoted-with-attribution' | 'own-translation' | 'cc0';
}

interface Parsed {
  type: 'proverb' | 'quote';
  attribution: Attribution;
  status: 'PD' | 'ANON' | 'IN_COPYRIGHT';
}

function blankAttr(): Attribution {
  return {
    work: null,
    character: null,
    actor: null,
    author: null,
    developer: null,
    publisher: null,
    source: null,
    year: null,
    links: {},
    rights: 'public-domain',
  };
}

function extractWork(raw: string): string | null {
  const italic = /\*([^*]+)\*/.exec(raw);
  if (italic?.[1]) return italic[1].trim();
  const han = /《([^》]+)》/.exec(raw);
  return han?.[1] ? han[1].trim() : null;
}
function extractYear(raw: string): number | null {
  const m = /\((\d{4})\)/.exec(raw);
  return m?.[1] ? Number.parseInt(m[1], 10) : null;
}
function extractLink(raw: string): string | null {
  const m = /\]\((https?:\/\/[^)]+)\)/.exec(raw);
  return m?.[1] ?? null;
}
function statusOf(raw: string): 'PD' | 'ANON' | 'IN_COPYRIGHT' {
  if (raw.includes('IN_COPYRIGHT')) return 'IN_COPYRIGHT';
  if (/\bANON\b/.test(raw)) return 'ANON';
  return 'PD';
}

/** Strip status tokens, the `equivalent` flag, stars, and the ⭐ marker. */
function cleanSeg(seg: string): string {
  return seg
    .replace(/`?equivalent`?/gi, '')
    .replace(/⭐/g, '')
    .replace(/\*\*?/g, '')
    .replace(/\((\d{4})\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Group A ("Author · Work · STATUS") and Group C ("Author · Work (year) …"). */
function parseAuthored(sourceCell: string, group: 'A' | 'C'): Parsed {
  const status = statusOf(sourceCell);
  const segs = sourceCell.split('·').map((s) => s.trim());
  const first = cleanSeg(segs[0] ?? '');
  const work = extractWork(sourceCell);
  const year = extractYear(sourceCell);
  const link = extractLink(sourceCell);
  const attr = blankAttr();

  const anon =
    group === 'A' && (status === 'ANON' || GENERIC_SOURCE.test(first) || BIBLE_REF.test(first));
  if (anon) {
    // Folk / scripture / anonymous → proverb with a source label.
    attr.source = first || PROVERB_LABEL.en;
    attr.year = year;
    return { type: 'proverb', attribution: attr, status };
  }
  // Named author → quote.
  attr.author = first;
  attr.work = work;
  attr.year = year;
  if (link) attr.links.work = link;
  return { type: 'quote', attribution: attr, status };
}

/** Group B UK: "Author/Generic · Work · STATUS". */
function parseUk(nguon: string): Parsed {
  const status = statusOf(nguon);
  const first = cleanSeg(nguon.split('·')[0] ?? '');
  const work = extractWork(nguon);
  const year = extractYear(nguon);
  const attr = blankAttr();
  const anon = status === 'ANON' || GENERIC_SOURCE.test(first) || BIBLE_REF.test(first) || !first;
  if (anon) {
    attr.source = first || PROVERB_LABEL.en;
    attr.year = year;
    return { type: 'proverb', attribution: attr, status };
  }
  attr.author = first;
  attr.work = work;
  attr.year = year;
  return { type: 'quote', attribution: attr, status };
}

/** Group B CJK / VN: the "kind" cell, optionally "kind · Author《Work》 · PD". */
function parseNativeKind(kindCell: string, locale: Locale): Parsed {
  const status = statusOf(kindCell);
  const segs = kindCell.split('·').map((s) => s.trim());
  const work = extractWork(kindCell);
  const year = extractYear(kindCell);
  const attr = blankAttr();

  if (segs.length >= 2) {
    // Second segment carries provenance: an author (王安石《元日》) or a classic work.
    const prov = segs[1] ?? '';
    const authorPart = cleanSeg(
      prov
        .replace(/《[^》]*》/g, '')
        .replace(/言해본|언해본/g, '')
        .trim(),
    );
    if (authorPart && !GENERIC_SOURCE.test(authorPart) && !authorPart.startsWith('(')) {
      attr.author = authorPart;
      attr.work = work;
      attr.year = year;
      return { type: 'quote', attribution: attr, status };
    }
    // Classic work with no personal author (e.g. 훈민정음) → proverb w/ work as source.
    attr.source = work ?? PROVERB_LABEL[locale];
    attr.year = year;
    return { type: 'proverb', attribution: attr, status };
  }
  // Bare kind → anonymous folk proverb, labelled per locale.
  attr.source = PROVERB_LABEL[locale];
  return { type: 'proverb', attribution: attr, status };
}

function rightsFor(
  locale: Locale,
  origin: Locale,
  status: 'PD' | 'ANON' | 'IN_COPYRIGHT',
): Attribution['rights'] {
  if (status === 'IN_COPYRIGHT') return 'quoted-with-attribution';
  return locale === origin ? 'public-domain' : 'own-translation';
}

// ---------------------------------------------------------------------------
// Records + id allocation
// ---------------------------------------------------------------------------

interface QuoteRecord {
  id: string;
  type: 'proverb' | 'quote';
  text: string;
  lang: string;
  translations: Record<string, string>;
  attribution: Attribution;
  regions: string[];
  tags: string[];
  holidays: string[];
}

const idMapPath = join(QUOTES, 'id-map.json');
const idMap: Record<string, string> = existsSync(idMapPath)
  ? (JSON.parse(readFileSync(idMapPath, 'utf8')) as Record<string, string>)
  : {};

// Seed the per-locale counter above any id already used by an existing file or map.
const nextN: Record<Locale, number> = { en: 0, vi: 0, ja: 0, ko: 0, 'zh-Hans': 0, 'zh-Hant': 0 };
const existing: Record<Locale, QuoteRecord[]> = {
  en: [],
  vi: [],
  ja: [],
  ko: [],
  'zh-Hans': [],
  'zh-Hant': [],
};

function bumpFromId(id: string): void {
  const m = /^(.*)-(\d+)$/.exec(id);
  if (!m) return;
  const loc = m[1] as Locale;
  if (loc in nextN) nextN[loc] = Math.max(nextN[loc], Number.parseInt(m[2] ?? '0', 10));
}

// Load existing en.json (seed) so its ids/quotes are preserved and never reused.
for (const loc of LOCALES) {
  const p = join(QUOTES, `${loc}.json`);
  if (!existsSync(p)) continue;
  const file = JSON.parse(readFileSync(p, 'utf8')) as { quotes: QuoteRecord[] };
  // Keep only seed records that this importer did NOT generate (no source in id-map).
  const generated = new Set(Object.values(idMap));
  existing[loc] = file.quotes.filter((q) => !generated.has(q.id));
  for (const q of existing[loc]) bumpFromId(q.id);
}
for (const id of Object.values(idMap)) bumpFromId(id);

function allocId(sourceKey: string, locale: Locale): string {
  const existingId = idMap[sourceKey];
  if (existingId) return existingId;
  nextN[locale] += 1;
  const id = `${locale}-${String(nextN[locale]).padStart(4, '0')}`;
  idMap[sourceKey] = id;
  return id;
}

const out: Record<Locale, QuoteRecord[]> = {
  en: [],
  vi: [],
  ja: [],
  ko: [],
  'zh-Hans': [],
  'zh-Hant': [],
};
const provenance: string[] = [
  '| QuoteAtlas id | source id | locale | type | author/source |',
  '|---|---|---|---|---|',
];

function emit(rec: QuoteRecord, sourceId: string): void {
  out[rec.lang as Locale].push(rec);
  const who = rec.attribution.author ?? rec.attribution.source ?? '';
  provenance.push(`| ${rec.id} | ${sourceId} | ${rec.lang} | ${rec.type} | ${who} |`);
}

// ---------------------------------------------------------------------------
// Group processing
// ---------------------------------------------------------------------------

const LOCALE_COL: Locale[] = ['en', 'vi', 'ja', 'ko', 'zh-Hans', 'zh-Hant'];

function processAC(md: string, group: 'A' | 'C'): void {
  for (const sec of parseSections(md)) {
    if (sec.header.length < 8) continue; // A/C tables are 8 columns
    const isHoliday = group === 'A';
    const holidayTag = isHoliday ? HOLIDAY_TAG[sec.anchor] : undefined;
    const themeTag = !isHoliday ? sec.anchor.replace(/^theme:\s*/, '').trim() : undefined;
    for (const row of sec.rows) {
      const sourceId = row[0]?.trim() ?? '';
      if (!sourceId) continue;
      const texts: Record<Locale, string> = {
        en: row[1] ?? '',
        vi: row[2] ?? '',
        ja: row[3] ?? '',
        ko: row[4] ?? '',
        'zh-Hans': row[5] ?? '',
        'zh-Hant': row[6] ?? '',
      };
      const sourceCell = row[7] ?? '';
      const parsed = parseAuthored(sourceCell, group);
      const origin: Locale = ORIGIN_ZH.has(sourceId) ? 'zh-Hans' : 'en';
      const originGroup: Locale[] = ORIGIN_ZH.has(sourceId) ? ['zh-Hans', 'zh-Hant'] : ['en'];

      for (const loc of LOCALE_COL) {
        const text = texts[loc].trim();
        if (!text) continue;
        const translations: Record<string, string> = {};
        for (const other of LOCALE_COL) {
          if (other !== loc && texts[other].trim()) translations[other] = texts[other].trim();
        }
        const attribution: Attribution = {
          ...parsed.attribution,
          links: { ...parsed.attribution.links },
          rights: rightsFor(loc, originGroup.includes(loc) ? loc : origin, parsed.status),
        };
        emit(
          {
            id: allocId(`${sourceId}|${loc}`, loc),
            type: parsed.type,
            text,
            lang: loc,
            translations,
            attribution,
            regions: LOCALE_REGIONS[loc],
            tags: themeTag ? [themeTag] : [],
            holidays: holidayTag ? [holidayTag] : [],
          },
          sourceId,
        );
      }
    }
  }
}

function processB(md: string): void {
  for (const sec of parseSections(md)) {
    const locales = sec.locale ? B_LOCALE_HEADING[sec.locale] : undefined;
    if (!locales) continue;
    const tag = HOLIDAY_TAG[sec.anchor];
    const isCn = sec.locale === 'zh';
    for (const row of sec.rows) {
      const sourceId = row[0]?.trim() ?? '';
      if (!sourceId) continue;
      if (isCn) {
        // | ID | 简体 | 繁體 | kind |
        const kindCell = row[3] ?? '';
        const variants: [Locale, string][] = [
          ['zh-Hans', row[1] ?? ''],
          ['zh-Hant', row[2] ?? ''],
        ];
        for (const [loc, text] of variants) {
          if (!text.trim()) continue;
          const parsed = parseNativeKind(kindCell, loc);
          emitNative(sourceId, loc, text.trim(), parsed, tag);
        }
      } else {
        // | ID | text | kind [| source] |
        const loc = locales[0]!;
        const text = row[1] ?? '';
        const kindCell = row[2] ?? '';
        const sourceCol = row[3];
        const parsed =
          loc === 'en' && sourceCol ? parseUk(sourceCol) : parseNativeKind(kindCell, loc);
        if (!text.trim()) continue;
        emitNative(sourceId, loc, text.trim(), parsed, tag);
      }
    }
  }
}

function emitNative(
  sourceId: string,
  loc: Locale,
  text: string,
  parsed: Parsed,
  tag: string | undefined,
): void {
  const attribution: Attribution = {
    ...parsed.attribution,
    links: { ...parsed.attribution.links },
    rights: parsed.status === 'IN_COPYRIGHT' ? 'quoted-with-attribution' : 'public-domain',
  };
  // A proverb must carry a source; a quote may rely on its author.
  if (parsed.type === 'proverb' && !attribution.source) attribution.source = PROVERB_LABEL[loc];
  emit(
    {
      id: allocId(`${sourceId}|${loc}`, loc),
      type: parsed.type,
      text,
      lang: loc,
      translations: {},
      attribution,
      regions: B_REGIONS[loc],
      tags: [],
      holidays: tag ? [tag] : [],
    },
    sourceId,
  );
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

processAC(readFileSync(join(SRC, '01-international-holidays.md'), 'utf8'), 'A');
processAC(readFileSync(join(SRC, '03-inspirational-quotes.md'), 'utf8'), 'C');
processB(readFileSync(join(SRC, '02a-native-proverbs-uk-vn.md'), 'utf8'));
processB(readFileSync(join(SRC, '02b-native-proverbs-jp-kr-cn.md'), 'utf8'));

// Length guard (schema: text ≤ 300).
const overlong = LOCALES.flatMap((l) => out[l]).filter((q) => q.text.length > 300);
if (overlong.length) {
  console.error(`import:content — ${overlong.length} text(s) exceed 300 chars:`);
  for (const q of overlong) console.error(`  ✗ ${q.id} (${q.text.length})`);
  process.exit(1);
}

// --- write per-locale quote files (seed records first, then imported) ---
// Dedupe by text within each locale: a few seed quotes recur in the imported set
// (e.g. Emerson's New-Year line, Bacon's "Knowledge is power"). The first record
// wins — seed quotes lead, so their richer attribution (author links) stays
// canonical and no text is ever shown twice.
let dropped = 0;
const final: Record<Locale, QuoteRecord[]> = {
  en: [],
  vi: [],
  ja: [],
  ko: [],
  'zh-Hans': [],
  'zh-Hant': [],
};
for (const loc of LOCALES) {
  const seenText = new Set<string>();
  for (const q of [...existing[loc], ...out[loc]]) {
    if (seenText.has(q.text)) {
      dropped += 1;
      continue;
    }
    seenText.add(q.text);
    final[loc].push(q);
  }
  writeFileSync(
    join(QUOTES, `${loc}.json`),
    `${JSON.stringify({ locale: loc, quotes: final[loc] }, null, 2)}\n`,
  );
}

// --- index.json (preserve the existing `generated` date so re-runs are stable) ---
const idxPath = join(QUOTES, 'index.json');
const priorGenerated = existsSync(idxPath)
  ? (JSON.parse(readFileSync(idxPath, 'utf8')) as { generated?: string }).generated
  : undefined;
const index = {
  dataVersion: 1,
  generated: process.env.QA_GEN_DATE ?? priorGenerated ?? new Date().toISOString().slice(0, 10),
  locales: LOCALES.map((loc) => ({
    code: loc,
    file: `${loc}.json`,
    count: final[loc].length,
    dir: 'ltr' as const,
    fontKey: FONT_KEY[loc],
    regions: LOCALE_REGIONS[loc],
  })),
};
writeFileSync(join(QUOTES, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);

// --- holiday registry: tags.json + international.json + overrides/*.json ---
const tags: Record<string, { scope: 'national' | 'international'; countries?: string[] }> = {};
for (const [tag, meta] of Object.entries(TAG_META)) {
  tags[tag] =
    meta.scope === 'national'
      ? { scope: 'national', ...(meta.countries ? { countries: meta.countries } : {}) }
      : { scope: 'international' };
}
writeFileSync(join(DATA, 'holidays', 'tags.json'), `${JSON.stringify(tags, null, 2)}\n`);

const intlAdds = Object.entries(TAG_META)
  .filter(([, m]) => m.scope === 'international' && m.rule)
  .map(([tag, m]) => ({ tag, rule: m.rule! }));
writeFileSync(
  join(DATA, 'holidays', 'international.json'),
  `${JSON.stringify(
    {
      _note:
        'International holidays applied for every region (scope=international in tags.json). Merged with per-country overrides at boot. Generated by scripts/import-content.ts.',
      add: intlAdds,
    },
    null,
    2,
  )}\n`,
);

const byCountry: Record<string, { tag: string; rule: string; days?: number }[]> = {};
for (const [tag, m] of Object.entries(TAG_META)) {
  if (m.scope !== 'national' || !m.rule || !m.countries) continue;
  for (const cc of m.countries) {
    (byCountry[cc] ??= []).push(
      m.days ? { tag, rule: m.rule, days: m.days } : { tag, rule: m.rule },
    );
  }
}
// Delete stale override files (this importer owns the whole set), then write fresh.
mkdirSync(OVERRIDES, { recursive: true });
for (const f of readdirSync(OVERRIDES)) if (f.endsWith('.json')) unlinkSync(join(OVERRIDES, f));
for (const [cc, adds] of Object.entries(byCountry)) {
  writeFileSync(
    join(OVERRIDES, `${cc}.json`),
    `${JSON.stringify({ country: cc, add: adds }, null, 2)}\n`,
  );
}

// --- allowlist: the one in-copyright entry cites snopes.com ---
const allowPath = join(DATA, 'allowlist-domains.json');
const allow = JSON.parse(readFileSync(allowPath, 'utf8')) as Record<string, string[]>;
const snopes = LOCALES.flatMap((l) => out[l])
  .map((q) => q.attribution.links.work)
  .find((u) => u?.includes('snopes.com'));
if (snopes && !(allow.extra ?? []).includes(snopes)) {
  allow.extra = [...(allow.extra ?? []), snopes];
  writeFileSync(allowPath, `${JSON.stringify(allow, null, 2)}\n`);
}

// --- id-map + provenance report ---
writeFileSync(idMapPath, `${JSON.stringify(idMap, null, 2)}\n`);
writeFileSync(join(SRC, 'provenance.report.md'), `${provenance.join('\n')}\n`);

const total = LOCALES.reduce((n, l) => n + final[l].length, 0);
console.log(
  `import:content — OK: ${total} quotes across ${LOCALES.length} locales (${dropped} duplicate text(s) dropped); ${Object.keys(byCountry).length} override file(s); ${intlAdds.length} international rule(s).`,
);
for (const loc of LOCALES)
  console.log(
    `  ${loc}: ${final[loc].length} (${existing[loc].length} seed + ${out[loc].length} imported)`,
  );
