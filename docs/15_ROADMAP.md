# 15 — Roadmap & Decision Log

## 1. Development phases (pre-1.0)

| Phase | Deliverable | Exit criteria |
|---|---|---|
| **P0** | Spikes S1–S4 (doc 11 §5) | All pass criteria met; outcomes logged in §4. S1 fail ⇒ Android fallback plan activates (Kotlin shell) before any feature work |
| **1** | Web core | Quote engine + region detect/picker + clock/amlich + color/gradient backgrounds + i18n EN/VI/JA; unit gates green |
| **2** | Content systems | Media pipeline (all caps + WebP ladder) + holidays + legal gate + error/offline pages + PWA; E2E smoke green |
| **3** | Desktop | 3-OS bundles, fullscreen, window-state, minisign updater end-to-end against a test release |
| **4** | Android | Signed APK, in-app update check, install/verify docs; re-run S1 checks on release build |
| **5** | v1.0 release | Doc 13 checklist; data pools: en + vi + ja + zh-Hans + zh-Hant + ko, ≥ 50 quotes each |

## 2. Content & feature waves (post-1.0) — locked plan

| Version | Scope | Engineering implications |
|---|---|---|
| **v1.1** | Enable `movie` / `game` / `book` types + first curated batch | Attribution links live (machinery ships dormant in v1.0); remove `.types-enabled` CI block |
| **v1.2–1.5** | Europe, 4 waves — suggested: FR+DE → ES+IT → PT+NL → PL+RU | Data + extended-Latin/Cyrillic subsets only |
| **v1.6–1.8** | Arab world, 3 waves — SA/AE/EG → MA/JO/IQ → rest | **RTL activation** (prep in doc 07 §6), Noto Naskh Arabic, Hijri calendar already mapped |
| **v1.9** | Southeast Asia — TH, ID, MY, PH, SG… | Thai font subset; Buddhist calendar already mapped |
| **v2.x** | Remaining regions (South Asia, LatAm, Africa…) | Per-wave review |

Per-wave country lists are suggestions ordered by source availability —
re-confirm at wave start via the doc 07 §3 checklist. **Earlier pools remain
editable forever**: add/fix/remove quotes in any later version
(semver: data-only = patch).

## 3. Post-v1 idea backlog (unscheduled, revisit after v1.1)

Share-quote-as-image (canvas export) · Android home-screen widget · desktop
"widget mode" (frameless transparent window, optional click-through) ·
screensaver mode with sleep-prevention · Windows code-signing certificate
(cost decision) · macOS notarization (cost decision) · favorites
export/print · community quote-pack process beyond PRs.

Permanently out: backend/accounts/sync · song lyrics · telemetry ·
runtime content downloads (would break the offline/privacy story).

## 4. Decision log

| Date | Decision |
|---|---|
| 2026-07-06 | Proposal v0.1 produced; stack verified (Node 24 LTS, TS 6.0.3, React 19.2.7, Vite 8.1.3, Tailwind 4.3.2, Tauri 2.11.x) |
| 2026-07-06 | **Name locked: QuoteAtlas**; identifiers derived (doc 00 §4) |
| 2026-07-06 | Architecture Option A locked (one codebase, Tauri 2 desktop+Android); WPF/Kotlin/Flutter rejected — rationale in proposal v0.1 §2 |
| 2026-07-06 | Media caps locked (doc 04 §7), incl. interpretations: counts = whole library (slideshow has no separate cap); 4K video split 125 MB web / 150 MB desktop+Android |
| 2026-07-06 | Locale rollout waves locked (§2); `book` type slotted with v1.1 alongside movie/game |
| 2026-07-06 | Licensing: code GPL-3.0 · own data CC0 · third-party quotes retained by owners |
| 2026-07-06 | Legal gate = blocking modal, versioned consent |
| 2026-07-06 | Attribution display templates + link allowlist locked (doc 04 §5–6) |
| 2026-07-06 | Geolocation permanently dropped; detection = timezone + languages + manual |
| 2026-07-06 | GSAP rejected (non-OSI license vs GPL bundling); Motion (MIT) adopted |
| 2026-07-06 | Cloudflare Pages over GitHub Pages (response-header control for CSP) |
| 2026-07-06 | Doc suite v1.0 (17 files) produced |
| *(next)* | P0 spike outcomes S1–S4 → record here |

## 5. Open items carried forward

⚠️ Human-only list in doc 00 §8 · per-wave country confirmations (§2) ·
amlich vector generation + one-time human verification (doc 11 §2) ·
S2 outcome decides the default-background stance (static vs video note).
