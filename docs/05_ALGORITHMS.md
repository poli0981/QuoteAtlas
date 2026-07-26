# 05 — Algorithms

All functions here are pure TypeScript in `src/features/*/` or `src/lib/` —
no DOM, no Tauri — and covered by the unit targets in doc 11.

## 1. PRNG — `lib/prng.ts`

`mulberry32(seed: number): () => number` — tiny, deterministic, good enough
for content shuffling (not cryptography — never used for security).

```ts
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashSeed = (s: string) =>            // FNV-1a 32-bit
  [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
```

## 2. Selection & anti-repeat — `features/quote/engine.ts`

```
select(pool, mode, history, todayHolidayTags):
  p ← holidayFilter(pool, todayHolidayTags)        // §4
  candidates ← p \ history                          // ring of last 50 ids
  if candidates empty: history.clear(); candidates ← p
  rng ← mode == 'daily'
          ? mulberry32(hashSeed(`${yyyymmdd}|${locale}|qa`))
          : mulberry32(cryptoRandomInt())           // per-load / rotate
  q ← candidates[floor(rng() * candidates.length)]
  history.push(q.id)                                // ring, FIFO evict
  return q
```

Properties: `daily` is stable across reloads for the whole local day and
differs per locale; `per-load` never repeats within the last 50 picks while
the pool allows; prev/next navigation walks a session stack without touching
the ring twice.

## 3. Day boundary

"Today" = user's local civil date (system timezone). The daily seed and the
holiday resolver both use it; a running app re-evaluates at local midnight
(1-second clock tick already exists — compare date string, cheap).

## 4. Holiday resolution & precedence — `features/holidays/resolver.ts`

```
resolve(date, country):
  base ← dateHolidays(country).isHoliday(date)      // library, lazily imported
  base ← applyOverrides(base, overrides[country])   // add/remove; lunar:* rules
         (lunar rules evaluated via §5 for VN-scoped tags)
  tags ← map matched holidays → tag ids (data/holidays/tags.json)
  return { national: tags where scope=national ∧ country matches,
           international: tags where scope=international }

holidayFilter(pool, {national, international}):
  n ← pool ∩ national tags;   if n ≠ ∅ → n          // national wins
  i ← pool ∩ international;   if i ≠ ∅ → i
  return pool                                        // never empty-screen
```

Multiple holidays on one day → union of their tags at the winning precedence
level.

**Rule grammar** (full table in doc 04 §3, implementation in
`features/holidays/rules.ts`): `M-D`, `lunar:M-D`, `easter[±N]`, `nth:M-W-N`,
`last:M-W`, `term:NAME[±N]`. Solar terms come from `solarTermDate()` in doc 05 §5
— the sun's ecliptic longitude at multiples of 15°, where 315° is lập xuân and
15° is thanh minh.

Two things the grammar has to get right that a date list cannot:

- **Relative holidays.** Shrove Tuesday is Easter − 47 and setsubun is the day
  before lập xuân. Both move by weeks between years.
- **Zone.** Lunisolar dates and solar terms are resolved in the region's own zone
  (VN +7, CN/TW/HK/MO/SG/MY +8, KR/JP +9). Resolving China's 春节 at Vietnam's
  UTC+7 puts it on the wrong day in 1968 and 2007, the same divergence §5
  describes.

Each rule is also evaluated against the **previous** year, so a span starting in
late December still matches in January.

## 5. Vietnamese lunar calendar — `features/clock/calendars/amlich.ts`

In-house implementation of the **Hồ Ngọc Đức algorithm** (astronomical new
moon + sun longitude per Jean Meeus, computed at **UTC+7**). This is the whole
reason the module exists: `Intl` calendar `chinese` computes at UTC+8 and
diverges from the Vietnamese calendar in known years — documented divergence
cases include 1968, 1985 and 2007-era dates. ⚠️ Test vectors must be generated
from Hồ Ngọc Đức's published tables (human-verified once), then frozen in
`fixtures/amlich-vectors.json` covering **1900–2100** (doc 11 §2).

Function surface:

```ts
convertSolar2Lunar(d, m, y, tz = 7): { day; month; year; leap: boolean }
convertLunar2Solar(day, month, year, leap, tz = 7): { d; m; y }
canChiYear(lunarYear): string        // (y+6)%10 stems · (y+8)%12 branches → "Bính Ngọ"
formatVi(lunar): string              // "ngày 22 tháng Năm (nhuận), Bính Ngọ"
```

Internal steps (standard for this algorithm): `jdFromDate` → `getNewMoonDay(k)`
→ `getSunLongitude` → `getLunarMonth11(y)` → leap-month placement → date
mapping. Keep it ≤ ~200 LOC, zero dependencies.

⚠️ **One deliberate departure from the published algorithm.** `k` is a *mean*
synodic estimate and a true lunation runs up to ~7 hours either side of the mean,
so `k + 1` can overshoot a month boundary by more than one step. The usual
`if (monthStart > dayNumber) k -= 1` steps back exactly once, which is one short
for 2054-05-07 and 2062-04-09 — both returned **lunar day 0**, an impossible date
that would have rendered as "ngày 0 tháng 4". `lunarMonthStart()` walks back until
the new moon is actually on or before the day. Only the backward direction is
needed: `floor(…) + 1` cannot land below the true index without the real new moon
running a whole synodic month ahead of the mean.

Other regional calendars use `Intl.DateTimeFormat` with `-u-ca-…`
(`chinese`, `japanese`, `dangi`, `buddhist`, `islamic-umalqura`, `hebrew`,
`persian`) — table in doc 07 §4.

## 6. Timezone → country — `features/region/detect.ts`

Build step `scripts/gen-tz-map.ts` derives `tz-to-country.json` from the IANA
`zone.tab` / CLDR data (committed, regenerated when tzdata updates).

```
detect():
  tz ← Intl.DateTimeFormat().resolvedOptions().timeZone
  country ← tzMap[tz]                        // "Asia/Ho_Chi_Minh" → VN
  if !country:                               // rare (e.g. "Etc/UTC")
    country ← region subtag of first navigator.languages entry (vi-VN → VN)
  return country ?? null                     // null → language-only fallback
```

Cached 24 h; manual picker always overrides; result and the fallback chain are
displayed, never silent (doc 03 §2).

## 7. Image compression ladder — `features/background/compressor.ts`

Runs in a Worker (OffscreenCanvas + `createImageBitmap`):

```
targetEdge ← class == P1080 ? 1920 : 3840
bitmap ← decode(file);  if longEdge > targetEdge → scale to targetEdge
for q in [0.80, 0.72, 0.65, 0.60]:
    blob ← canvas.convertToBlob({ type: "image/webp", quality: q })
    if blob.size ≤ cap(class) → return blob
throw QaError("E_MEDIA_UNCOMPRESSIBLE")      // extremely rare; UI → option (1)
```

EXIF orientation honored via `createImageBitmap(file, {imageOrientation:
"from-image"})`. Animated inputs skip the ladder (stored as-is if within cap).

## 8. Readability scrim & contrast estimate

```
sample ← draw current background frame → 24×24 canvas
L ← mean relative luminance of the rows behind the quote block
ratio ← contrast(L, fontColor)
if ratio < 4.5 → show non-blocking hint + suggest scrim ≥ suggested %
```

Scrim = user-adjustable overlay 0–80 % (black or white auto-picked against
font color). Estimate is advisory only — never auto-changes user styling.

## 9. Semver & content updates

`MAJOR.MINOR.PATCH`: data-only change → **patch**; new locale or new feature →
**minor**; breaking settings/schema → **major** (with settings migration in
`storage/migrations.ts`, versioned by `settings.version`).
