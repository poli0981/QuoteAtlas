# CLAUDE.md — QuoteAtlas

Guidance for AI agents (Claude Code) working in this repository.
Read this first; each area has a deep-dive doc in `docs/` (map in
`docs/00_PROJECT_OVERVIEW.md §6`).

## What this is

QuoteAtlas — ambient quote display (proverbs/quotations, later movie/game/
book lines) with region-based pools, live clock + regional calendars
(Vietnamese lunar in-house), holiday-aware selection, deep background
customization. **One React SPA core** built with Vite, deployed as: static
web (Cloudflare Pages, PWA) + desktop (Tauri 2: Win/macOS/Linux) + Android
12+ APK (Tauri 2 mobile, sideload). **No backend. No telemetry. Offline-first.**

Stack (verified 2026-07-06, details `docs/01`): Node 24 LTS · TypeScript
6.0.3 · React 19.2.7 · Vite 8.1.3 · Tailwind 4.3.2 · Motion · Zustand 5 ·
i18next · Tauri 2.11.x · Rust stable.

## Build phases (work in order; do not skip gates)

0. **P0 spikes S1–S4** (`docs/11 §5`) — Android-on-device, video power, amlich
   vectors, updater chain. Binding pass criteria; log outcomes in `docs/15 §4`.
1. Web core: engine, region, clock/amlich, color/gradient bg, i18n EN/VI/JA.
2. Content systems: media pipeline + caps, holidays, legal gate, error pages, PWA.
3. Desktop: bundles, fullscreen, window-state, minisign updater e2e.
4. Android: signed APK, in-app update check, verify docs.
5. v1.0 release per `docs/13` checklist (6 locale pools, ≥ 50 quotes each).

## Hard rules (violations are always bugs)

- **R1 — Privacy:** no telemetry/analytics/beacons; `fetch` allowed **only**
  under `src/features/updater/` (lint-enforced); `navigator.geolocation` is
  banned entirely.
- **R2 — Media caps** live only in `src/features/background/limits.ts`
  (values: `docs/04 §7`). No literal caps anywhere else.
- **R3 — One attribution formatter** (`features/quote/attribution.ts`) used
  by UI _and_ `scripts/gen-attributions.ts`. Templates: `docs/04 §5`.
- **R4 — `en` quote pool always exists**; region fallback chain per
  `docs/03 §2` and is surfaced in UI, never silent.
- **R5 — Dependencies:** adding/updating a runtime dep requires a GPL-3.0
  compatibility check + `THIRD_PARTY_NOTICES` update in the same PR. GSAP is
  explicitly rejected (`docs/01 §2`).
- **R6 — Tauri capabilities/CSP** (`docs/09 §2–3`) may only change with a
  doc update in the same PR; no remote content in the webview, ever.
- **R7 — Data via schema only:** `data/**` edits must pass
  `npm run validate:data` (+ link allowlist). Quote text ≤ 300 chars; **no
  song lyrics** — content policy `docs/14 §3`. movie/game/book types stay
  CI-blocked until v1.1.
- **R8 — amlich:** Vietnamese lunar dates come from `calendars/amlich.ts`
  (UTC+7) only — never `Intl` `chinese` for VN. Module must pass the frozen
  vector fixture before being wired into UI.
- **R9 — i18n:** no literal user-facing strings; keys mirrored across
  en/vi/ja (parity script). Layout uses CSS **logical** properties only.
- **R10 — CI stubs declare `permissions:` explicitly** (ops-repo lesson);
  actions SHA-pinned; secrets never echoed.
- **R11 — Legal gate** (`LEGAL_VERSION`) can never be bypassed, feature-
  flagged off, or auto-accepted.
- **R12 — Never delete a published release** referenced by `latest.json`;
  quote ids are append-only.

## Commands (package.json contract — CI calls exactly these)

```
npm run dev | build | preview
npm run tauri:dev | tauri:build | tauri:android:dev | tauri:android:build
npm run lint | format | typecheck | knip
npm run validate:data | subset:fonts | gen:attributions | gen:tzmap
npm run test | coverage | e2e
```

## Layout (full tree: `docs/02 §3`)

`src/app` shell/routes/error-states · `src/features/*` vertical slices with
pure domain logic (no DOM/Tauri imports in domain files) · `src/lib`
platform adapters (`platform.ts`, storage, prng, log-buffer) · `data/`
content + schemas (no code) · `src-tauri/` thin Rust shell (no business
logic) · `scripts/` build-time generators.

## Definition of done (any PR)

typecheck ✚ eslint ✚ prettier ✚ knip ✚ tests (coverage gates `docs/11 §1`)
✚ validate:data ✚ i18n parity — all green; docs updated when behavior,
capabilities, dependencies, or data formats changed; Conventional Commit
(`data:` type exists for content).

## When unsure

Prefer the doc over memory; prefer shrinking scope over adding dependencies;
prefer pure functions over effects; ask the maintainer before touching
`docs/14` legal texts (bumping `LEGAL_VERSION` re-gates every user).
