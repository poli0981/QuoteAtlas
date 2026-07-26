# 01 — Tech Stack

> Versions verified against official sources on **2026-07-06**.
> Rule: pin via lockfiles, upgrade via Renovate PRs, never hand-edit versions in docs without re-verifying.

## 1. Core toolchain

| Component | Version | Notes |
|---|---|---|
| Node.js | **24.x (Active LTS)** | LTS until 2028-04. Node 22 = Maintenance; Node 26 = Current only (LTS 2026-10) — do not use for production builds yet |
| Package manager | npm (repo standard) | Committed `package-lock.json`; CI installs with `npm ci --ignore-scripts` where possible |
| TypeScript | **6.0.3** | Last JS-based release; designed as bridge to TS 7 (native). Adopt TS 7 when stable — expected low-friction from 6.0 |
| React | **19.2.7** | ⚠️ "React2Shell" affected 19.0.0–19.2.0 *with RSC only*, fixed 19.2.1+. QuoteAtlas is a pure SPA (no RSC) but the floor is still `>=19.2.7` |
| Vite | **8.1.3** | Rolldown bundler (Rust). Requires Node 20.19+/22.12+ → satisfied. React plugin: `@vitejs/plugin-react` **v6** (Oxc, no Babel) |
| Tailwind CSS | **4.3.2** | CSS-first config (`@theme`), `@tailwindcss/vite` plugin, built-in `text-shadow-*`, logical-property utilities (needed for RTL wave) |
| Tauri | **2.11.x** (core 2.11.5 · CLI 2.11.4 · `@tauri-apps/api` 2.11.1) | Stable since 2024-10, externally audited; plugins follow core major |
| Rust | latest stable via `rustup` | Pinned per-repo with `rust-toolchain.toml`; 6-week release train |

## 2. Application libraries (install latest at scaffold time, then lockfile-pinned)

| Library | Role | License |
|---|---|---|
| Motion (`motion`) | Quote crossfade, word-stagger reveal, page transitions | MIT ✔ GPL-compatible |
| Zustand v5 | Settings/state, `persist` middleware with platform storage adapter | MIT |
| i18next + react-i18next | UI localization (EN/VI/JA) — independent from quote locales | MIT |
| date-holidays | Per-country holiday rules, dynamically imported per country | ISC |
| vite-plugin-pwa (Workbox) | Web offline precache + update prompt | MIT |
| ajv (dev/CI only) | JSON Schema validation of `data/**` | MIT |
| subset-font (build script) | Glyph-subsetting bundled fonts against static data (doc 07 §5) | MIT |
| lychee (CI, Rust binary) | Weekly dead-link scan over attribution URLs | Apache-2.0/MIT |

**Explicitly rejected:** GSAP — free of charge since the Webflow acquisition but
its license is *not* OSI open source → GPL-3.0 bundling risk. Motion + CSS cover
every planned effect. three.js/WebGL — unnecessary for v1 visual language,
costs bundle + battery. Velopack — .NET ecosystem; superseded here by
`tauri-plugin-updater`.

## 3. Tauri plugins (only these; capabilities in doc 09 §3)

`updater` (desktop only) · `process` · `dialog` · `fs` (scoped
`$APPDATA/backgrounds/**`) · `store` · `opener` · `single-instance` (desktop) ·
`window-state` (desktop) · `os`.

## 4. Fonts (self-hosted, OFL 1.1, no Google Fonts CDN)

| Slot | Font | Coverage |
|---|---|---|
| UI | Be Vietnam Pro (variable) | Latin + full Vietnamese |
| Quote serif | Lora Variable *(default)*; Playfair Display kept as candidate until UI mock review | Latin + Vietnamese |
| Quote CJK | Noto Serif JP / SC / TC / KR | ja / zh-Hans / zh-Hant / ko |
| Future waves | Noto Naskh Arabic (v1.6+), Noto Serif Thai (v1.9) | RTL / Thai |

All CJK/heavy fonts pass the **build-time glyph subsetting** step (doc 07 §5) —
feasible because all rendered text (data + UI strings) is static. `woff2`,
`font-display: swap`, preload for the active locale only.

## 5. Android build configuration

| Item | Value |
|---|---|
| minSdk | **31** (Android 12) — raise from Tauri default 24 |
| targetSdk / compileSdk | **36** (Android 16) |
| ABI | `arm64-v8a` primary + optional universal APK |
| JDK | 21 (Temurin) |
| NDK | r28+ → **16 KB page size** compliant |
| Signing | own keystore, apksigner v2+v3 (doc 13 §2) |
| Manifest | `allowBackup="false"`, cleartext blocked, **INTERNET permission only** |

## 6. Dev environment

JetBrains IDEs (existing subscription): WebStorm or IDEA Ultimate for the web
core, RustRover/CLion optional for `src-tauri`. VS Code acceptable as a
lightweight alternative. Android device or emulator (API 31 image + a real
low-end Android 12 phone for the P0 spike, doc 11 §5).

## 7. Version & CVE policy ("no known CVEs" as a *process*)

1. Lockfiles (`package-lock.json`, `Cargo.lock`) committed — reproducible builds.
2. **Renovate** weekly, grouped PRs; majors get a dedicated PR + changelog read.
3. CI gates on every PR: `npm audit --audit-level=high`, **osv-scanner**
   (npm + crates), `cargo audit`. Any hit blocks merge (doc 12 §4).
4. GitHub Actions pinned by **commit SHA** (ops-repo convention).
5. GitHub private vulnerability reporting enabled; policy in doc 09 §7.
6. Never adopt a pre-release (`beta`, `rc`, Node "Current") in `main`.
