# 03 — Data Flow

## 1. Boot flow

```
start
 ├─ load settings (adapter)            ── missing → defaults
 ├─ legal gate: consentVersion == LEGAL_VERSION ?
 │    └─ no → BLOCKING gate modal (doc 06 §10) → store consent → continue
 ├─ region = settings.regionOverride
 │           ?? cached detection (24 h TTL)
 │           ?? detect(timezone, navigator.languages)      (doc 05 §6)
 ├─ fetch data/quotes/index.json (bundled → same-origin, instant)
 ├─ resolve locale chain: region → language → 'en'         (§2)
 ├─ lazy-load quotes/<locale>.json  (+ cache in memory)
 ├─ holidays = resolve(today, region)                      (doc 05 §4)
 ├─ quote = select(pool, mode, history, holidays)          (doc 05 §2–3)
 └─ render; then if platformKind ≠ web && settings.autoCheckUpdate
      → updater check (§5) after 5 s idle
```

## 2. Region → locale fallback chain

```
region (e.g. TW) ─ has pool? ──────────────► zh-Hant
   │ no
   ▼
primary language of navigator.languages present in index? ► that locale
   │ no
   ▼
'en'  (guaranteed present — hard rule, CLAUDE.md R4)
```

The chain result is surfaced in the region picker ("Showing: English —
no Icelandic pool yet") so fallback is never silent.

## 3. Quote selection pipeline (per render / rotation tick)

```
pool(locale)
 → holiday filter: national tags ∪ international tags matched today
      non-empty intersection ? restrict : keep full pool
 → minus history ring (last 50 ids; ring cleared if it would empty the pool)
 → mode:
     'per-load'  → prng(random seed) pick
     'daily'     → prng(seed = yyyymmdd + locale) pick   (stable all day)
     'rotate'    → per-load pick every N s (30–3600)
 → push id into history ring → render QuoteView + attribution line
```

## 4. Background media import flow

```
file picked
 ├─ type sniff (magic bytes, not extension)
 ├─ IMAGE: read dimensions
 │    ├─ class = longEdge ≤1920 ? P1080 : ≤3840 ? P4K : OVERSIZE
 │    ├─ bytes ≤ cap(class) and not OVERSIZE → store as-is
 │    └─ else → dialog:
 │         (1) "I'll shrink it myself"  → abort
 │         (2) "Compress automatically" → worker: resize to class edge,
 │              WebP q .80 → .72 → .65 → .60 until ≤ cap; still over → error
 ├─ VIDEO: read metadata (duration, height)
 │    ├─ duration > 182 s  → reject + trim guidance (LosslessCut)
 │    ├─ height > 2160     → reject
 │    └─ bytes > cap(height, platform) → reject + compress guidance (HandBrake)
 ├─ library count ≥ cap(platform) → reject "library full" (doc 06 §5)
 └─ write via media adapter → update library index in settings
```

Caps live **only** in `src/features/background/limits.ts` (see doc 04 §7 for
the exact table). Quota errors from OPFS surface as `E_MEDIA_QUOTA` with the
usage meter opened.

## 5. Update check flow (desktop & Android)

```
GET api.github.com/repos/poli0981/quoteatlas/releases/latest
    headers: If-None-Match: <cached etag>, timeout 10 s
 ├─ 304                → "up to date" (silent when auto)
 ├─ 200 → semver newer?
 │    ├─ no  → up to date
 │    └─ yes → dialog: version + changelog excerpt
 │          Desktop: download via plugin-updater → verify minisign sig
 │                   → install → relaunch (plugin `process`)
 │          Android: button opens release page in browser; app shows the
 │                   expected SHA-256 for manual verify (doc 08 §4)
 ├─ 403 with x-ratelimit-remaining: 0, or 429
 │        → E_UPDATE_RATELIMIT (retry after x-ratelimit-reset)
 ├─ 404   → E_UPDATE_NO_RELEASE
 ├─ 5xx   → E_UPDATE_SERVER
 ├─ network/timeout → E_UPDATE_OFFLINE
 └─ bad signature (desktop) → E_UPDATE_BADSIG — abort install
```

Auto-check: at most once per 24 h, only after first paint, only if enabled
(default **on** for desktop/Android, dialog copy in doc 06 §9). Web: Workbox
`needRefresh` → reload toast; no GitHub API call from the web app (CSP keeps
`connect-src 'self'`).

## 6. Bug report flow

```
[Report bug] (Settings, error dialogs, crash view)
 → collect: appVersion, platformKind, os, locale, region, last ring-buffer
   entries (redacted, doc 09 §6)
 → build GitHub issue-form URL (?template=bug_report.yml&version=…&logs=…)
 ├─ URL ≤ 7 000 chars → opener/anchor opens prefilled issue
 └─ else → logs copied to clipboard + toast "paste into the Logs field"
 → alternative button: "Export logs (.txt)"
```

No automatic transmission ever — every report is a user click.

## 7. Settings persistence

Zustand store → `persist` → platform adapter. Written debounced (500 ms).
Media binaries are **not** inside settings; the library index holds adapter
keys/paths only. Export/Import produces `quoteatlas-settings-*.json`
(schema in doc 04 §8) and never bundles media files.

## 8. Data update lifecycle (content releases)

Quote/holiday edits land as normal PRs → AJV + allowlist CI gates →
merged → next release bundles them (patch bump if data-only). Web users get
content on redeploy immediately; desktop/Android on next app update. There is
no runtime content download — keeps offline-first and the privacy story exact.
