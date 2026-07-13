/**
 * i18n key-parity gate (docs/07 §1, docs/12 §4): every UI language must mirror
 * the English key set 1:1, per namespace. English is the source of truth.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'src/locales');
const BASE = 'en';
const errors: string[] = [];

function languages(): string[] {
  return readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
}

function flatten(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out.push(...flatten(v, prefix ? `${prefix}.${k}` : k));
  }
  return out;
}

function keysFor(lang: string, ns: string): Set<string> {
  const p = join(root, lang, ns);
  if (!existsSync(p)) return new Set();
  return new Set(flatten(JSON.parse(readFileSync(p, 'utf8'))));
}

const namespaces = readdirSync(join(root, BASE)).filter((f) => f.endsWith('.json'));
const others = languages().filter((l) => l !== BASE);

for (const ns of namespaces) {
  const baseKeys = keysFor(BASE, ns);
  for (const lang of others) {
    const langKeys = keysFor(lang, ns);
    for (const k of baseKeys) if (!langKeys.has(k)) errors.push(`${lang}/${ns}: missing "${k}"`);
    for (const k of langKeys) if (!baseKeys.has(k)) errors.push(`${lang}/${ns}: extra "${k}"`);
  }
}

if (errors.length > 0) {
  console.error(`i18n:check — ${errors.length} parity problem(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exitCode = 1;
} else {
  console.log(
    `i18n:check — OK (${namespaces.length} namespace(s) × ${languages().length} language(s))`,
  );
}
