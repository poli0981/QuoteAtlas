# 11 — Testing

## 1. Layers

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest (+ v8 coverage) | pure domain modules (doc 02 §2) |
| Component | Vitest + Testing Library | QuoteView, RegionPicker, gate, dialogs |
| E2E smoke | Playwright (web build) | boot → quote visible → switch region → change background → error pages |
| Data | AJV via `validate:data` | every PR touching `data/**` |
| Manual matrix | checklist §6 | every release |

Coverage gates: **100 %** line coverage on `amlich.ts`, `engine.ts`,
`resolver.ts`, `attribution.ts`, `detect.ts`; ≥ 80 % overall on `src/features`
+ `src/lib`. UI shells excluded from the hard gate.

## 2. Vietnamese lunar vectors (the critical fixture)

`fixtures/amlich-vectors.json`: ≥ 400 solar↔lunar pairs spanning **1900–2100**,
including every Tết date, all leap-month years, and the known VN/CN divergence
years (1968, 1985, 2007 era). ⚠️ Human step, once: generate/verify vectors
against Hồ Ngọc Đức's published tables before trusting the module — the test
suite is only as good as the vectors. Property tests on top:
`convertLunar2Solar(convertSolar2Lunar(d)) === d` for 5 000 random dates.

## 3. Other unit targets (minimum cases)

- **engine**: daily-mode determinism (same day+locale ⇒ same id; different
  locale ⇒ may differ), anti-repeat ring semantics incl. pool-exhaustion
  reset, holiday-filter precedence (national > international > none),
  empty-tag never blanks the screen.
- **detect**: tz→country hits, `Etc/UTC` fallback to language subtag,
  override wins, cache TTL.
- **resolver**: override add/remove, `lunar:` rules resolved via amlich,
  multi-holiday union.
- **attribution**: all five templates, field-collapsing, markdown variant
  parity (same segments), link presence per doc 04 §5.
- **compressor**: ladder order, class edges (1920/3840 boundaries at exactly
  1920 and 1921), EXIF orientation, `E_MEDIA_UNCOMPRESSIBLE` path (mock
  encoder).
- **limits**: platform profile selection; every cap referenced from
  `limits.ts` only (grep-test that no literal caps exist elsewhere).
- **i18n**: en/vi/ja key-set parity script.

## 4. Known environment caveats to test around

Safari/WebKit: OPFS quota small, `convertToBlob('image/webp')` support must
be feature-detected — fallback = only option (1) in the oversize dialog +
copy explaining why. Playwright runs the smoke suite on chromium **and**
webkit to catch this class.

## 5. P0 spikes (run before feature work; pass criteria are binding)

| # | Spike | Pass criteria |
|---|---|---|
| S1 | Tauri 2 Android end-to-end on real devices (a low-end Android 12 phone + an Android 16 device) | APK installs & launches; 1080p video bg loops ≥ 30 min without crash; OPFS/app-dir media write→read OK; VI+JA glyphs render with subset fonts |
| S2 | Video background power cost (Android + laptop) | Measure 30-min battery/CPU delta video vs static; if video > 3× static drain → default background stays static and video carries an in-UI battery note |
| S3 | amlich module + vectors | 100 % of §2 vectors pass; round-trip property holds |
| S4 | Updater chain end-to-end (test repo) | minisign-signed update installs on all 3 desktop OS; tampered sig **refuses** (`E_UPDATE_BADSIG`); Android dialog → browser → hash shown matches release |

Spike outcomes are recorded in doc 15 §4 (decision log). S1 failure triggers
the fallback plan (doc 02 note: native Kotlin shell for Android only).

## 6. Manual release checklist (excerpt; full list lives in doc 13 §6)

Fresh install legal gate on all 3 platforms · region auto-detect in a VN and
a JP environment (or spoofed tz) · holiday override day (set clock to Tết) ·
oversize-image both dialog paths · library-full toast at cap · fullscreen
hides window controls (Win/macOS/Linux) · update-error dialogs by blocking
api.github.com in hosts · offline web reload (PWA) · bug-report URL opens
prefilled · settings export/import round-trip.

## 7. Test data hygiene

Fixtures never contain real third-party movie/game lines (use invented
placeholders) so the test tree stays trivially clean of rights questions.
