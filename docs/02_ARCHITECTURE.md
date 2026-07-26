# 02 — Architecture

## 1. Shape: one core, three shells

```
┌──────────────────────────────────────────────────────────────┐
│                 React SPA core (TypeScript)                  │
│  features/quote · clock · holidays · background · region ·   │
│  settings · legal · updater · bug-report                     │
│  reads bundled data/quotes/*.json · data/holidays/*          │
└──────────────┬────────────────────────────┬──────────────────┘
               │ static build (Vite)        │ Tauri 2 (single project)
               ▼                            ▼
     Cloudflare Pages (PWA)      ┌──────────┴──────────┐
     SW precache = full offline  ▼                     ▼
                             Desktop                Android 12+
                     NSIS / .dmg / .AppImage         .apk (sideload)
                     plugin-updater (minisign)    in-app check → browser
```

There is **no backend**. The web deployment and the Tauri webview load the
same `dist/` output. Platform differences are isolated behind adapters (§4).

## 2. Layering (Clean Architecture, pragmatic)

| Layer | Contents | May import |
|---|---|---|
| `src/app` | Shell, router, error/offline states, gate mounting | features, lib |
| `src/features/*` | Vertical slices: UI + hooks + pure domain logic per feature | lib, other features' *public* index only |
| `src/lib` | Platform adapters, PRNG, log buffer, storage, `platform.ts` | nothing app-specific |
| `data/` | Content + schemas — **no code** | — |
| `src-tauri/` | Rust shell: window mgmt, capabilities, plugin wiring — **no business logic** | — |

Dependency rule: downward only. Domain logic (selection, calendars, holiday
resolution, attribution formatting) is **pure TypeScript with zero DOM/Tauri
imports** so it is unit-testable and reusable by build scripts.

## 3. Directory tree

```
quoteatlas/
├── CLAUDE.md
├── docs/                         # this suite (00–15)
├── data/
│   ├── quotes/                   # vi.json en.json ja.json zh-Hans.json zh-Hant.json ko.json + index.json
│   ├── holidays/overrides/       # per-country corrections (lunar VN etc.)
│   ├── allowlist-domains.json    # attribution link allowlist (doc 04 §6)
│   └── schema/                   # quote.schema.json · holiday-override.schema.json · index.schema.json
├── public/
│   ├── _headers                  # Cloudflare security headers (doc 09 §1)
│   ├── 404.html
│   └── fonts/                    # subsetted woff2 (generated, committed)
├── scripts/
│   ├── validate-data.ts          # AJV over data/** (CI gate)
│   ├── subset-fonts.ts           # glyph subsetting (doc 07 §5)
│   ├── gen-attributions.ts       # ATTRIBUTIONS.md generator (imports src formatter)
│   └── gen-tz-map.ts             # CLDR → tz-to-country.json (build-time)
├── src/
│   ├── app/                      # App.tsx, routes, ErrorBoundary, offline/404/403/429/5xx views
│   ├── features/
│   │   ├── quote/                # engine.ts selection · attribution.ts (single formatter) · QuoteView
│   │   ├── clock/                # Clock view · calendars/ (amlich.ts, intl-calendars.ts)
│   │   ├── holidays/             # resolver.ts + overrides loader
│   │   ├── region/               # detect.ts (tz+lang) · RegionPicker · fallback chain
│   │   ├── background/           # limits.ts (ALL caps live here) · compressor.ts · library.ts · SlideshowPlayer
│   │   ├── settings/
│   │   ├── legal/                # Gate modal + legalVersion logic
│   │   ├── updater/              # desktop.ts (plugin) · android.ts (GitHub API) · web.ts (SW)
│   │   └── bug-report/           # issue-url builder + log export
│   ├── lib/
│   │   ├── platform.ts           # isTauri(), platformKind(): 'web'|'desktop'|'android'
│   │   ├── storage/              # settings adapter (localStorage | tauri-store), media adapter (OPFS | fs)
│   │   ├── log-buffer.ts         # 200-entry ring, redaction (doc 09 §6)
│   │   └── prng.ts               # mulberry32 + seed helpers
│   ├── locales/                  # UI i18n: en/ vi/ ja/ (JSON namespaces)
│   └── styles/                   # tailwind entry, @theme tokens
├── src-tauri/
│   ├── capabilities/default.json
│   ├── gen/android/              # generated; applicationId com.skullmute.quoteatlas, minSdk 31
│   └── tauri.conf.json           # CSP, bundle targets, updater artifacts
└── .github/workflows/            # thin stubs calling poli0981/.github reusable workflow
```

## 4. Platform adapters (the only place platforms differ)

| Concern | Web | Desktop | Android |
|---|---|---|---|
| Settings persistence | `localStorage` | `tauri-plugin-store` | `tauri-plugin-store` |
| Media storage | OPFS (+ `persist()`), IndexedDB fallback | `fs` plugin → `$APPDATA/backgrounds/` | same as desktop |
| Media caps source | `limits.ts` → `WEB` profile | `limits.ts` → `DESKTOP_ANDROID` profile | same |
| External links | `<a target="_blank" rel="noopener noreferrer">` | `opener` plugin | `opener` plugin |
| Update | `web.ts` (SW `needRefresh`) | `desktop.ts` (plugin-updater) | `android.ts` (GitHub API + browser) |
| Fullscreen | `documentElement.requestFullscreen()` | `getCurrentWindow().setFullscreen(true)` | immersive default |

`platform.ts` decides once at boot; features consume the injected adapter, never
sniff the platform inline. Adding a platform = adding an adapter, not editing
features.

## 5. Boot sequence (detail in doc 03 §1)

settings load → legal-gate check (blocking) → region resolve (cached) →
`data/quotes/index.json` → lazy-load active locale file → holiday resolve →
select quote → render → (desktop/Android, if enabled) background update check.

## 6. Error architecture

- `QaError` base class with `code` (`E_DATA_LOAD`, `E_MEDIA_QUOTA`,
  `E_UPDATE_403`, …) — codes map 1:1 to i18n keys and to the dialog copy table
  in doc 06 §9.
- React `ErrorBoundary` at app root → friendly crash view with "Report bug".
- All throws route through `log-buffer.ts` so bug reports carry context.

## 7. Non-goals enforced by architecture

No network module besides `updater/` (imports of `fetch` outside it fail a
custom ESLint rule) · no `navigator.geolocation` anywhere · no dynamic remote
content in the Tauri webview (CSP + capability locked, doc 09).
