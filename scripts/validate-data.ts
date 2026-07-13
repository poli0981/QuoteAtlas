/**
 * Validates data/** (CI gate — CLAUDE.md R7, docs/04, docs/12 §4):
 *  - AJV (2020-12, strict) against data/schema/*.schema.json
 *  - text ≤ 300 chars (also schema) and `en` locale present (R4)
 *  - index `count` matches the actual quote count
 *  - attribution links host-allowlisted per type (or exact-listed in `extra`)
 *  - movie/game/book rejected unless data/quotes/.types-enabled exists
 *
 * Lyrics are a reviewer-checklist item (docs/14 §6), not machine-checkable here.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

interface LocaleEntry {
  code: string;
  file: string;
  count: number;
  dir: string;
  fontKey: string;
  regions: string[];
}
interface LocaleIndex {
  dataVersion: number;
  generated: string;
  locales: LocaleEntry[];
}
interface QuoteRec {
  id: string;
  type: string;
  text: string;
  attribution: { links: { work?: string; author?: string } };
}
interface QuoteFile {
  locale: string;
  quotes: QuoteRec[];
}
type Allowlist = Record<string, string[]>;

const dataDir = join(process.cwd(), 'data');
const errors: string[] = [];

function loadJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(dataDir, rel), 'utf8')) as unknown;
}

// strict mode on; strictTypes relaxed so if/then attribution refinements (which
// add `properties` constraints without re-declaring type:object) are allowed.
const ajv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: true,
  strict: true,
  strictTypes: false,
});
addFormats(ajv);

const validateIndex = ajv.compile<LocaleIndex>(loadJson('schema/index.schema.json') as object);
const validateQuotes = ajv.compile<QuoteFile>(loadJson('schema/quote.schema.json') as object);
const validateOverride = ajv.compile(loadJson('schema/holiday-override.schema.json') as object);

function report(label: string, ok: boolean, errs: typeof ajv.errors): void {
  if (!ok && errs) {
    for (const e of errs) errors.push(`${label}: ${e.instancePath || '/'} ${e.message ?? ''}`);
  }
}

function hostAllowed(url: string, allowed: string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowed.some((d) => host === d || host.endsWith(`.${d}`));
}

// --- index ---
const indexData = loadJson('quotes/index.json');
report('index.json', validateIndex(indexData), validateIndex.errors);
const index = indexData as LocaleIndex;

if (!index.locales.some((l) => l.code === 'en')) {
  errors.push('R4: the `en` locale must be present in index.json');
}

const typesEnabled = existsSync(join(dataDir, 'quotes/.types-enabled'));
const allow = loadJson('allowlist-domains.json') as Allowlist;
const BLOCKED_TYPES = ['movie', 'game', 'book'];

// --- quote files ---
for (const loc of index.locales) {
  const fileData = loadJson(`quotes/${loc.file}`);
  report(loc.file, validateQuotes(fileData), validateQuotes.errors);
  const file = fileData as QuoteFile;

  if (file.quotes.length !== loc.count) {
    errors.push(`${loc.file}: index count ${loc.count} ≠ actual ${file.quotes.length}`);
  }

  for (const q of file.quotes) {
    if (BLOCKED_TYPES.includes(q.type) && !typesEnabled) {
      errors.push(
        `${q.id}: type "${q.type}" is CI-blocked until v1.1 (no data/quotes/.types-enabled)`,
      );
    }
    const typeList = allow[q.type] ?? [];
    for (const [field, url] of Object.entries(q.attribution.links)) {
      if (typeof url !== 'string') continue;
      if (!hostAllowed(url, typeList) && !(allow.extra ?? []).includes(url)) {
        errors.push(`${q.id}: link ${field}=${url} not allowlisted for type "${q.type}"`);
      }
    }
  }
}

// --- holiday overrides (optional) ---
const overridesDir = join(dataDir, 'holidays/overrides');
if (existsSync(overridesDir)) {
  for (const name of readdirSync(overridesDir)) {
    if (!name.endsWith('.json')) continue;
    const ov = loadJson(`holidays/overrides/${name}`);
    report(`overrides/${name}`, validateOverride(ov), validateOverride.errors);
  }
}

if (errors.length > 0) {
  console.error(`validate:data — ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exitCode = 1;
} else {
  const total = index.locales.reduce((n, l) => n + l.count, 0);
  console.log(`validate:data — OK (${index.locales.length} locale(s), ${total} quote(s))`);
}
