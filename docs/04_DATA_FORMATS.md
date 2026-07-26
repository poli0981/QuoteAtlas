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

`lunar:M-D` rules are evaluated by the in-house Vietnamese lunar module
(doc 05 §5) — never by the library — so VN dates are always UTC+7-correct.

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
