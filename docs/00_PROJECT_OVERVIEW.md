# 00 — Project Overview

> **Project:** QuoteAtlas
> **Doc suite version:** 1.0 (2026-07-06)
> **Author:** poli0981 / SkullMute · **License:** code GPL-3.0, data mixed (see doc 14)
> **Platforms:** Web (PWA) · Desktop Windows/macOS/Linux · Android 12+ (APK sideload)

## 1. Elevator pitch

QuoteAtlas is an ambient quote display. It shows one famous proverb, quotation,
or (from v1.1) movie/game/literature line at the center of the screen — fully
attributed and linked to a reputable source — selected to match the user's
**region**, with a live clock and the region's **traditional calendar**
(Vietnamese lunar, Japanese era, Buddhist calendar…). On holidays it shows only
holiday-appropriate quotes. Users can switch to any other region's quote pool
and deeply customize the background (color / transparent / image / video /
slideshow). One codebase serves all three platforms.

## 2. Product principles

1. **Offline-first.** All quote data, holiday rules, and fonts are bundled.
   No backend server exists. The only network call is the GitHub Releases
   update check (desktop/Android, can be disabled).
2. **Privacy-first.** No analytics, no telemetry, no third-party CDN, no
   location permission. Region detection uses timezone + system languages only.
3. **Ambient / calm UI.** Usable as a fullscreen "quiet display": gentle
   transitions, cursor auto-hide, `prefers-reduced-motion` respected.
4. **One source of truth.** One React core, one data set, one attribution
   formatter, one i18n layer — reused verbatim on every platform.

## 3. Locked decisions (2026-07-06)

| # | Topic | Decision |
|---|---|---|
| 1 | Name | **QuoteAtlas** (resolved ✔ — identifiers in §4) |
| 2 | Architecture | One React SPA core + Tauri 2 shell for desktop **and** Android (Option A) |
| 3 | Image limits | 25 files (web) / 40 (desktop+Android); ≤ 10 MB @1080p-class, ≤ 25 MB @4K-class per file |
| 4 | Video limits | 10 files (web) / 20 (desktop+Android); ≤ 3:00 each; ≤ 50 MB @1080p; ≤ 125 MB (web) / 150 MB (desktop+Android) @4K |
| 5 | Locale rollout | v1.0: EN + VI + East Asia → v1.1: movie/game/book types → v1.2–1.5: Europe → v1.6–1.8: Arab world (RTL) → v1.9: SEA → v2.x: rest. Earlier pools stay editable |
| 6 | Web hosting | Cloudflare Pages (`_headers` → real security headers) |
| 7 | Licensing | Code GPL-3.0 · self-authored quotes/translations **CC0** · third-party quotes remain their owners' |
| 8 | Legal gate | **Blocking modal** on first run/visit, versioned consent |
| 9 | Attribution | Fixed display templates per type with embedded reputable links (doc 04 §5, doc 06 §7) |
| — | Geolocation | **Dropped.** No GPS/Geolocation API anywhere (timezone + language + manual picker only) |
| — | Updater | Desktop `tauri-plugin-updater` (minisign) · Android in-app check → browser download · Web Service Worker. Velopack not used (that is the .NET ecosystem) |

## 4. Identifiers (canonical across docs and code)

| Context | Value |
|---|---|
| Product / window title / UI name | `QuoteAtlas` (identical in EN/VI/JA) |
| Repo slug | `poli0981/quoteatlas` ⚠️ confirm at repo creation |
| `package.json` name / Rust crate | `quoteatlas` |
| Tauri identifier / Android `applicationId` | `com.skullmute.quoteatlas` ⚠️ confirm bundle-id prefix |
| Web deployment | `quoteatlas.pages.dev` (Cloudflare Pages, no custom domain yet) |
| Code prefix | `Qa*` (`QaError`, `QaUpdateError`, `qa-log-buffer.ts`) |
| APK artifact | `quoteatlas-v{version}-android-arm64.apk` (Obtainium-friendly, stable pattern) |
| Windows installer | `QuoteAtlas-Setup-x64.exe` |
| Settings export | `quoteatlas-settings-YYYYMMDD-HHmm.json` |

## 5. Platform matrix

| Capability | Web | Desktop | Android |
|---|---|---|---|
| Quote engine / clock / calendars / holidays | ✔ | ✔ | ✔ |
| Background media library | 25 img / 10 vid (OPFS) | 40 / 20 (`$APPDATA/backgrounds`) | 40 / 20 (app data dir) |
| Fullscreen (window chrome hidden) | Browser fullscreen API | `setFullscreen(true)` — OS hides − ▢ × | Immersive by default |
| Update mechanism | Service Worker prompt | plugin-updater + minisign | In-app check → browser APK download |
| Legal gate | First-visit modal | First-run screen | First-run screen |
| Offline | Full (PWA precache) | Full (native) | Full (native) |

## 6. Documentation map (17 files)

| File | Content |
|---|---|
| `CLAUDE.md` | AI-agent guidance: build phases, hard rules, commands |
| `docs/00_PROJECT_OVERVIEW.md` | This file |
| `docs/01_TECH_STACK.md` | Pinned versions (verified 2026-07-06), libraries, fonts, version policy |
| `docs/02_ARCHITECTURE.md` | Layers, directory tree, platform adapters, Tauri integration |
| `docs/03_DATA_FLOW.md` | Boot, region detection, selection pipeline, media, update, bug report |
| `docs/04_DATA_FORMATS.md` | Quote JSON Schema, index manifest, holidays, allowlist, storage layout |
| `docs/05_ALGORITHMS.md` | PRNG, anti-repeat, QotD, Vietnamese lunar calendar, compression ladder |
| `docs/06_UI.md` | Layout, typography, backgrounds, error pages, gate, attribution rendering |
| `docs/07_I18N.md` | UI locales, quote locales, calendars, font subsetting, RTL readiness |
| `docs/08_PLATFORM_COMPLIANCE.md` | Tauri capabilities, Android sideload specifics, PWA/host specifics |
| `docs/09_SECURITY_PRIVACY.md` | CSP, headers, hardening, supply chain, privacy model |
| `docs/10_CODING_STANDARDS.md` | TS/React/Rust style, lint/format/dead-code tooling |
| `docs/11_TESTING.md` | Unit/E2E strategy, lunar vectors, P0 spikes with pass criteria |
| `docs/12_CI_CD.md` | Reusable workflow in `poli0981/.github`, jobs, secrets, permissions |
| `docs/13_RELEASE_PUBLISHING.md` | Artifacts, signing (minisign/GPG/apksigner), checklist, Obtainium |
| `docs/14_LEGAL_GATE.md` | Gate spec + draft EULA / Disclaimer / Privacy / notices / LICENSE-DATA (EN+VI) |
| `docs/15_ROADMAP.md` | Dev phases, locale waves, post-v1 ideas, decision log |

## 7. Out of scope (v1.x)

Backend/API server · accounts/sync · user-submitted quotes at runtime (repo PRs
only) · client-side video transcoding · iOS · song lyrics (permanently banned,
see doc 14) · widgets/screensaver mode (post-v1 candidates, doc 15).

## 8. ⚠️ Human-only action items

1. ~~Confirm repo slug and bundle-id prefix~~ — done: `poli0981/QuoteAtlas`
   (capitalised), `com.skullmute.quoteatlas`.
2. ~~Create the Cloudflare project + `CLOUDFLARE_API_TOKEN` secret~~ — done, but
   as a **Workers** project with a Git integration that builds on every push to
   `main`, not a classic Pages project. Live at `https://qouteatlas.app/`.
3. ~~Generate the Android keystore~~ — done (v0.1.0 APK is signed, v3 scheme).
   The minisign updater keypair is **not** needed: the desktop updater is out of
   scope and Android updates go through the GitHub release check.
4. ~~Fill contact email placeholders~~ — done: `contact@qouteatlas.app`
   (Cloudflare Email Routing), used in `legal/PRIVACY.md`, `legal/DISCLAIMER.md`
   and §4 below.
5. ~~Add `LICENSE` and `LICENSE-DATA.md`~~ — done.
6. App icon set — a placeholder white-triangle icon ships; a final brand icon,
   the raster PWA/social images, and listing screenshots are still owed.
7. A domain **was** bought (`qouteatlas.app`) — the "no domains" line below no
   longer holds. Still no certificates required (Cloudflare terminates TLS, and
   the desktop bundles are unsigned).
8. Still open: the release GPG key (`SECURITY.md` prints a `«gpg-fingerprint»`
   placeholder and `release.yml` does not sign `SHA256SUMS`), and the amlich
   vector sign-off that gates the lunar date line (R8).
