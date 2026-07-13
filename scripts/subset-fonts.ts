/**
 * Build-time glyph subsetting (docs/07 §5). Because every rendered string is
 * static (bundled data + UI locales), fonts are subset to the exact glyph set.
 *
 * Source OFL TTFs live in fonts-src/ (a human-supplied asset, not committed —
 * docs/00 §8). When absent this no-ops so the pipeline stays green.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';

const root = process.cwd();
const srcDir = join(root, 'fonts-src');
const outDir = join(root, 'public/fonts');

if (!existsSync(srcDir)) {
  console.log(
    'subset:fonts — no fonts-src/ directory; skipping (source OFL TTFs are human-supplied, docs/07 §5).',
  );
  process.exit(0);
}

function collectGlyphs(): string {
  const set = new Set<string>();
  for (const ch of '0123456789 .,:;!?—–·…()[]“”"\'@/%') set.add(ch);
  const quotesDir = join(root, 'data/quotes');
  for (const f of readdirSync(quotesDir)) {
    if (!f.endsWith('.json')) continue;
    for (const ch of readFileSync(join(quotesDir, f), 'utf8')) set.add(ch);
  }
  const localesDir = join(root, 'src/locales');
  if (existsSync(localesDir)) {
    const walk = (dir: string): void => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (ent.name.endsWith('.json')) for (const ch of readFileSync(p, 'utf8')) set.add(ch);
      }
    };
    walk(localesDir);
  }
  return [...set].join('');
}

const glyphs = collectGlyphs();
mkdirSync(outDir, { recursive: true });
let n = 0;
for (const f of readdirSync(srcDir)) {
  if (!/\.(?:ttf|otf)$/i.test(f)) continue;
  const key = f.replace(/\.(?:ttf|otf)$/i, '');
  const subset = await subsetFont(readFileSync(join(srcDir, f)), glyphs, { targetFormat: 'woff2' });
  writeFileSync(join(outDir, `${key}.woff2`), subset);
  n += 1;
}
console.log(`subset:fonts — wrote ${n} subset font(s) → ${outDir}`);
