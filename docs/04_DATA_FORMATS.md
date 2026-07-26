# 04 — Data Formats

All files UTF-8 (no BOM), LF, validated in CI by `scripts/validate-data.ts`
(AJV, strict mode) against `data/schema/*.schema.json`.

## 1. Quote record — `data/quotes/<locale>.json`

Each locale file: `{ "locale": "vi", "quotes": [ QuoteRecord… ] }`.

```jsonc
{
  "id": "vi-0001",                  // ^<locale>-\d{4,}$ — unique, never reused after deletion
  "type": "proverb",                // proverb | quote | movie | game | book
  "text": "Có công mài sắt, có ngày nên kim.",
  "lang": "vi",                     // BCP-47 of `text`
  "translations": { "en": "Perseverance grinds an iron bar into a needle." },
  "attribution": {
    "work": null,                   // movie/book/game title
    "character": null,
    "actor": null,                  // movie only — the actor who delivers the line
    "author": null,                 // book/quote author
    "developer": null,              // game only
    "publisher": null,              // game only
    "source": "Tục ngữ Việt Nam",   // proverb/quote provenance label
    "year": null,
    "links": {},                    // { "work": url, "author": url } — rules in §6
    "rights": "public-domain"       // public-domain | quoted-with-attribution | own-translation | cc0
  },
  "regions": ["VN"],                // ISO 3166-1 alpha-2; drives region pools
  "tags": ["perseverance"],
  "holidays": []                    // holiday tag ids, e.g. ["tet","new-year"] (§4)
}
```

### Conditional requirements (JSON Schema `if/then`, enforced in CI)

| `type` | Required attribution fields | Required `links` |
|---|---|---|
| `proverb` | `source` | — |
| `quote` | `author` (or `source`) | `author` → Wikipedia (recommended) |
| `movie` | `work`; `character`/`actor` when known | `work` → IMDb/allowlist **required** |
| `book` | `work`, `author`; `character` when known | `work` **required**; `author` recommended |
| `game` | `work`; `developer` or `publisher`; `character` when known | `work` → official site or Steam **required** |

Content policy constraints also validated: `text` ≤ 300 chars (≈ 1–2
sentences); `type` values `movie|game|book` are **rejected by CI until v1.1**
(flag file `data/quotes/.types-enabled`); lyrics are banned by policy (doc 14
§6) — reviewer checklist item, not machine-checkable.

## 2. Locale index — `data/quotes/index.json`

```jsonc
{
  "dataVersion": 1,                 // bump on breaking schema change only
  "generated": "2026-07-06",
  "locales": [
    { "code": "vi", "file": "vi.json", "count": 420,
      "dir": "ltr", "fontKey": "serif-vi", "regions": ["VN"] },
    { "code": "zh-Hant", "file": "zh-Hant.json", "count": 180,
      "dir": "ltr", "fontKey": "serif-tc", "regions": ["TW","HK","MO"] }
  ]
}
```

`regions` here is the region→locale routing table used by the fallback chain
(doc 03 §2). `'en'` must always exist (hard rule).

## 3. Holiday tag registry & overrides

`data/holidays/tags.json` — canonical tag ids with scope:

```jsonc
{ "tet":        { "scope": "national", "countries": ["VN"] },
  "new-year":   { "scope": "international" },
  "mid-autumn": { "scope": "national", "countries": ["VN","CN","TW","HK","KR"] } }
```

`data/holidays/overrides/<CC>.json` — corrections/additions layered **on top
of** `date-holidays` output:

```jsonc
{ "country": "VN",
  "add":    [ { "tag": "tet", "rule": "lunar:1-1", "days": 5 },
              { "tag": "hung-kings", "rule": "lunar:3-10" } ],
  "remove": [ "some-wrong-entry-name" ] }
```

### Rule grammar

Implemented in `src/features/holidays/rules.ts`; the schema pattern in
`data/schema/holiday-override.schema.json` is the gate.

| form | means | example |
| --- | --- | --- |
| `M-D` | fixed Gregorian date | `12-25` |
| `lunar:M-D` | lunisolar date, in the region's own zone | `lunar:1-1` |
| `easter` | Easter Sunday (Gregorian computus) | `easter` |
| `easter±N` | N days from Easter | `easter-47` |
| `nth:M-W-N` | Nth weekday W of month M (W: 0=Sun…6=Sat) | `nth:5-0-2` |
| `last:M-W` | last weekday W of month M | `last:5-1` |
| `term:NAME` | first day of a solar term (tiết khí / 節気) | `term:qingming` |
| `term:NAME±N` | N days from a solar term | `term:lichun-1` |

The offset forms are what make holidays *defined relative to something else*
expressible at all: Shrove Tuesday is Easter − 47, Mothering Sunday is
Easter − 21, and setsubun is the day before lập xuân. Written as fixed dates they
would be wrong in most years. Named terms live in `TERM_LONGITUDE`; an unnamed
one resolves to null, because a typo is not a holiday.

⚠️ **Lunisolar rules and solar terms are resolved in the region's own zone**, not
Vietnam's. A new moon or a term crossing minutes either side of local midnight
lands on a different day in a different zone — which is exactly why Tết and 春节
fall a day apart in 1968 and 2007 (doc 05 §5, R8). VN is UTC+7, CN/TW/HK/MO/SG/MY
UTC+8, KR/JP UTC+9. `lunar:M-D` is evaluated by the in-house module (doc 05 §5),
never by a library.

A country's own `add` entry for a tag **shadows** the international rule for the
same tag rather than adding a second date for it — that is how Britain gets
Mothering Sunday instead of the second Sunday of May. `remove` cannot express
this: it drops the tag everywhere, including the country's own replacement.

## 4. Attribution link allowlist — `data/allowlist-domains.json`

```jsonc
{ "movie": ["imdb.com"],
  "book":  ["wikipedia.org", "wikisource.org"],
  "game":  ["store.steampowered.com"],
  "quote": ["wikipedia.org"],
  "extra": []                       // per-quote escape hatch: exact URLs approved in review
}
```

CI rejects any `links.*` whose host (or registrable domain) is outside the
type's list unless the exact URL is present in `extra`. Wildcards match
subdomains (`vi.wikipedia.org` ✔). A weekly `lychee` run opens an issue for
dead links (doc 12 §6).

## 5. Attribution display contract

One formatter — `src/features/quote/attribution.ts` — consumed by the app UI
**and** `scripts/gen-attributions.ts`. Output segments, in locked order
(underline = linked):

| type | Rendered line |
|---|---|
| movie | — <u>Work</u> – Character – Actor |
| book | — Character – <u>Work</u> – <u>Author</u> |
| game | — Character – <u>Work</u> – Developer/Publisher |
| quote | — <u>Author</u> *(link if present)* |
| proverb | — Source label (e.g. "Tục ngữ Việt Nam") |

Missing optional fields collapse (separators removed); `work` (or
`author`/`source`) is the guaranteed minimum. Markdown variant replaces
underline with `[text](url)`.

## 6. Storage layout (runtime)

| Store | Web | Desktop / Android |
|---|---|---|
| Settings | `localStorage["qa.settings.v1"]` | tauri-store `settings.json` |
| Media files | OPFS `/backgrounds/<uuid>.<ext>` | `$APPDATA/backgrounds/<uuid>.<ext>` |
| Media index | inside settings: `[{id,kind,bytes,w,h,duration?,addedAt}]` | same |
| History ring / favorites | inside settings (ids only) | same |
| Updater etag cache | inside settings | same |

## 7. Media caps table (mirrors `limits.ts` — single source in code)

| Constant | Web | Desktop + Android |
|---|---|---|
| `IMAGE_MAX_FILES` | 25 | 40 |
| `IMAGE_MAX_BYTES_1080` (long edge ≤ 1920) | 10 MB | 10 MB |
| `IMAGE_MAX_BYTES_4K` (long edge ≤ 3840) | 25 MB | 25 MB |
| `IMAGE_MAX_LONG_EDGE` | 3840 (above → must resize) | 3840 |
| `VIDEO_MAX_FILES` | 10 | 20 |
| `VIDEO_MAX_SECONDS` | 180 (+2 tolerance) | 180 (+2) |
| `VIDEO_MAX_BYTES_1080` (height ≤ 1080) | 50 MB | 50 MB |
| `VIDEO_MAX_BYTES_4K` (height ≤ 2160) | **125 MB** | **150 MB** |
| Accepted image | jpg png webp avif (+ animated gif/webp, counted as image) | same |
| Accepted video | mp4 (H.264/AAC), webm (VP9/AV1) | same |
| `MIN_VISIBLE_FRACTION` (aspect gate) | 0.75 | 0.75 |

**Aspect gate.** Backgrounds are fitted with `cover`, so media that does not match
the display is *cropped*, not letterboxed — and the further off it is, the more it
is also blown up. Import refuses anything that would keep less than
`MIN_VISIBLE_FRACTION` of the frame. 4:3 on 16:9 lands exactly on the line and is
accepted; a square keeps 56% and is refused.

The comparison is **orientation-agnostic** — both ratios normalise to long edge ÷
short edge — so a 9:16 clip scores identically to a 16:9 one. It *is* a perfect
fit held upright, and a verdict that flipped with how the device happened to be
turned at import time would be arbitrary. For the same reason the reference is
`screen`, not the window, which can be resized a second later. An unmeasurable
screen always resolves to "fits": a gate that cannot see the display must never be
the reason an import fails.

Note this is strict on tall phones by design — on a 20:9 screen an ordinary 4:3
photo keeps only 60% and is refused. The error names the shape to aim for.

## 8. Settings export — `quoteatlas-settings-YYYYMMDD-HHmm.json`

```jsonc
{ "format": "quoteatlas-settings", "version": 1, "exportedAt": "…",
  "settings": { …store snapshot minus media index… } }
```

Import validates `format` + `version`, merges known keys only, never touches
media. Unknown future keys are preserved round-trip.

## 9. Log ring entry (bug reports)

`{ t: epochMs, level: "error"|"warn", code?: "E_…", msg: string }` — 200-entry
ring, redaction rules in doc 09 §6, serialization capped at 6 000 chars for
issue-URL embedding.
