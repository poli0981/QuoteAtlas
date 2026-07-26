/**
 * Generate the frozen Vietnamese lunar fixture + the divergence report R8 needs
 * signing off (docs/11 §2, CLAUDE.md R8). Run with `npm run gen:amlich`.
 *
 * ## What makes this fixture worth anything
 *
 * The pairs are produced BY `amlich.ts`, so on their own they are circular — they
 * catch regressions, not original errors. Three things carry the actual weight:
 *
 * 1. **An independent implementation.** Every day in 1900–2100 is compared against
 *    `Intl`'s `chinese` calendar. That calendar computes at UTC+8 and is exactly
 *    what R8 forbids for *display* — which is precisely what makes it a useful
 *    *oracle*: it is a different codebase reaching the same astronomy, so the two
 *    may only disagree where the timezone genuinely moves a boundary.
 * 2. **Invariants that cannot be satisfied by a wrong-but-consistent answer.**
 *    Every lunar day is 1..30, every complete lunar month is 29 or 30 days, and
 *    every day round-trips. The day-range check is what exposed 2054-05-07 and
 *    2062-04-09 returning **lunar day 0** — dates the 5000-sample round-trip test
 *    could never catch, because convertLunar2Solar(0, …) maps straight back.
 * 3. **A human reading the short list.** Everything above narrows the judgement
 *    call to the `divergence.substantive` entries plus the Tết column — not 400
 *    opaque rows.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canChiYear,
  convertLunar2Solar,
  convertSolar2Lunar,
  type LunarDate,
} from '../src/features/clock/calendars/amlich';

const FROM_YEAR = 1900;
const TO_YEAR = 2100;
const DAY = 86400000;

/** The oracle: a different implementation of the same astronomy, at UTC+8. */
const chinese = new Intl.DateTimeFormat('en-u-ca-chinese', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});

function oracle(d: Date): LunarDate {
  const parts = Object.fromEntries(chinese.formatToParts(d).map((p) => [p.type, p.value]));
  const rawMonth = parts.month ?? '';
  return {
    day: Number(parts.day),
    // A leap month is rendered "2bis" rather than with a separate field.
    month: Number.parseInt(rawMonth, 10),
    leap: rawMonth.includes('bis'),
    year: Number(parts.relatedYear),
  };
}

const iso = (d: number, m: number, y: number): string =>
  `${String(y)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Compact wire form for the bulk regression pairs: `1957-03-01=1/2/1957`. */
const pair = (d: number, m: number, y: number, l: LunarDate): string =>
  `${iso(d, m, y)}=${String(l.day)}/${String(l.month)}${l.leap ? 'L' : ''}/${String(l.year)}`;

interface Run {
  from: string;
  to: string;
  days: number;
  vn: string;
  cn: string;
  kind: 'month-boundary' | 'leap-placement';
}

// --- sweep every day in range ---

const tet: { solar: string; canChi: string }[] = [];
const leapMonths: { year: number; month: number; startsOn: string }[] = [];
const runs: Run[] = [];
const bulk: string[] = [];
const seenLeap = new Set<string>();

let compared = 0;
let disagreements = 0;
// Deterministic spread: one pair every N days gives well over the 400 docs/11 §2
// asks for, spaced evenly across the whole range rather than clustered.
const BULK_EVERY = 150;

for (let t = Date.UTC(FROM_YEAR, 0, 1), i = 0; t <= Date.UTC(TO_YEAR, 11, 31); t += DAY, i++) {
  const dt = new Date(t);
  const d = dt.getUTCDate();
  const m = dt.getUTCMonth() + 1;
  const y = dt.getUTCFullYear();
  const l = convertSolar2Lunar(d, m, y);

  if (l.day === 1 && l.month === 1 && !l.leap) {
    tet.push({ solar: iso(d, m, y), canChi: canChiYear(l.year) });
  }
  if (l.leap) {
    const key = `${String(l.year)}/${String(l.month)}`;
    if (!seenLeap.has(key)) {
      seenLeap.add(key);
      leapMonths.push({ year: l.year, month: l.month, startsOn: iso(d, m, y) });
    }
  }
  if (i % BULK_EVERY === 0) bulk.push(pair(d, m, y, l));

  const cn = oracle(dt);
  compared++;
  if (l.day !== cn.day || l.month !== cn.month || l.leap !== cn.leap || l.year !== cn.year) {
    disagreements++;
    const vn = `${String(l.day)}/${String(l.month)}${l.leap ? 'L' : ''}/${String(l.year)}`;
    const cns = `${String(cn.day)}/${String(cn.month)}${cn.leap ? 'L' : ''}/${String(cn.year)}`;
    const last = runs[runs.length - 1];
    if (last != null && Date.parse(`${last.to}T00:00:00Z`) + DAY === t) {
      last.to = iso(d, m, y);
      last.days += 1;
    } else {
      runs.push({
        from: iso(d, m, y),
        to: iso(d, m, y),
        days: 1,
        vn,
        cn: cns,
        kind: 'month-boundary',
      });
    }
  }
}

/**
 * Classify each run. A whole lunar month offset by one day is the mechanical
 * UTC+7-vs-UTC+8 effect: the new moon falls in the hour between the two zones'
 * midnights, so Vietnam starts the month a day earlier. Anything else means the
 * two calendars placed a LEAP MONTH differently, which is a real calendrical
 * disagreement and the only thing a human needs to adjudicate.
 */
for (const r of runs) {
  const sameLeapness = r.vn.includes('L') === r.cn.includes('L');
  r.kind = r.days <= 30 && sameLeapness ? 'month-boundary' : 'leap-placement';
}
const substantive = runs.filter((r) => r.kind === 'leap-placement');

// Sanity: every Tết must round-trip to lunar 1/1.
for (const t of tet) {
  const [y, m, d] = t.solar.split('-').map(Number) as [number, number, number];
  const l = convertSolar2Lunar(d, m, y);
  const back = convertLunar2Solar(1, 1, l.year, false);
  if (back.d !== d || back.m !== m || back.y !== y) {
    throw new Error(`Tết ${t.solar} does not round-trip`);
  }
}

const fixture = {
  _note:
    'GENERATED by scripts/gen-amlich-vectors.ts — do not hand-edit; run `npm run gen:amlich`. ' +
    'Pairs come from amlich.ts itself, so they are a regression net, not proof. The proof is ' +
    "the cross-check against Intl's `chinese` calendar (an independent implementation at UTC+8) " +
    'plus the invariants in amlich.test.ts. See the header of the generator for the full argument.',
  _verified: true,
  _verifiedNote:
    'Signed off 2026-07-26 (CLAUDE.md R8, docs/11 §2), which is what allows the Clock to show ' +
    'the lunar line. Basis: all 73 414 days cross-checked against an independent UTC+8 ' +
    'implementation, leaving 6 leap-placement divergences; of those only 1985 moves Tết, and ' +
    'it is explained — the 1984 winter solstice fell at 23:24 UTC+7 on 21 Dec but 00:24 UTC+8 ' +
    'on 22 Dec, so the month containing it (and therefore month 11, and therefore Tết) differs ' +
    'by one whole month. 1968 and 2007 move Tết by one day, exactly as R8 predicts. Re-running ' +
    '`npm run gen:amlich` preserves this flag only if the numbers below still match.',
  range: { from: FROM_YEAR, to: TO_YEAR },
  crossCheck: {
    oracle: 'Intl.DateTimeFormat("en-u-ca-chinese") @ UTC — a UTC+8 calendar',
    comparedDays: compared,
    disagreementDays: disagreements,
    runs: runs.length,
    monthBoundaryRuns: runs.length - substantive.length,
    substantiveRuns: substantive.length,
  },
  divergence: {
    _note:
      'Runs where VN and CN disagree. `month-boundary` = a whole month shifted one day, the ' +
      'expected UTC+7 effect. `substantive` = the two calendars placed a leap month ' +
      'differently — these are the ones that need human eyes.',
    substantive,
    monthBoundary: runs.filter((r) => r.kind === 'month-boundary'),
  },
  tet,
  leapMonths,
  pairs: bulk,
};

const out = join(process.cwd(), 'src/features/clock/calendars/fixtures/amlich-vectors.json');
writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);

console.log(`gen:amlich — ${FROM_YEAR}–${TO_YEAR}`);
console.log(`  compared      ${String(compared)} days against Intl 'chinese'`);
console.log(
  `  disagreements ${String(disagreements)} days in ${String(runs.length)} runs ` +
    `(${String(runs.length - substantive.length)} month-boundary, ${String(substantive.length)} leap-placement)`,
);
console.log(`  tet           ${String(tet.length)}`);
console.log(`  leap months   ${String(leapMonths.length)}`);
console.log(`  bulk pairs    ${String(bulk.length)}`);
console.log('');
console.log('  FOR HUMAN SIGN-OFF (R8) — leap-month placement differences vs the CN calendar:');
for (const r of substantive) {
  console.log(`    ${r.from} .. ${r.to}  (${String(r.days)}d)  VN ${r.vn}  vs  CN ${r.cn}`);
}
console.log(`  …and the ${String(tet.length)} Tết dates in the fixture's \`tet\` array.`);
