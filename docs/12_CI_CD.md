# 12 — CI/CD

Integrates with the central ops repo **`poli0981/.github`** (reusable
workflows, SHA-pinned actions). QuoteAtlas introduces one new reusable
template there: **`tauri-multiplatform.yml`** — the first template covering
web + desktop-matrix + Android from a single repo.

## 1. Caller stub in this repo (`.github/workflows/ci.yml`)

Lesson from the Phase-5 migration sweep applies verbatim: **caller stubs must
declare `permissions:` explicitly** — inherited defaults were the root cause
of the ops-repo permissions bug.

```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
permissions:
  contents: read            # explicit — never rely on inheritance
jobs:
  ci:
    uses: poli0981/.github/.github/workflows/tauri-multiplatform.yml@<pinned-sha>
    with: { mode: ci }
    secrets: inherit
```

`release.yml` stub: `on: push: tags: ['v*']`, `permissions: contents: write`,
`with: { mode: release }`.

## 2. Reusable workflow jobs (`mode: ci`)

| Job | Runner | Steps (each = an `npm run` script, doc 10 §9) |
|---|---|---|
| `quality` | ubuntu | `npm ci --ignore-scripts` → typecheck → lint → prettier --check → knip → validate:data → subset-fonts staleness check → test + coverage gates |
| `audit` | ubuntu | npm audit (high) → osv-scanner (npm + Cargo) → cargo audit |
| `web` | ubuntu | vite build → Playwright smoke (chromium + webkit) → upload `dist/` artifact |
| `desktop` | matrix: windows / macos / ubuntu | `tauri build` (debug-signing off in CI mode) — compile check only, artifacts discarded |
| `android` | ubuntu (JDK 21, NDK r28) | `tauri android build --apk --target aarch64` unsigned — compile check |

PR gating: `quality` + `audit` + `web` required; `desktop`/`android` required
on `main` pushes (path-filtered: skipped for `data:`-only and docs-only PRs
to keep content PRs fast).

## 3. `mode: release` (tag `v*`)

```
quality + audit (reuse)
 → web:      build → wrangler pages deploy → quoteatlas.pages.dev
 → desktop:  matrix build with TAURI_SIGNING_PRIVATE_KEY (minisign)
             → NSIS exe · dmg (universal) · AppImage/deb/rpm + latest.json + *.sig
 → android:  build → zipalign → apksigner (keystore from secrets)
             → quoteatlas-v{v}-android-arm64.apk (+ universal)
 → assemble: download all → generate SHA256SUMS → gpg --detach-sign (.asc)
             → create GitHub Release (notes from CHANGELOG section)
             → attach everything incl. latest.json
```

Release is atomic: any job failure → no partial release (draft until
assemble succeeds, then published).

## 4. Blocking gates summary

typecheck · eslint · prettier · knip · AJV data validation · allowlist-domain
check · i18n key parity · font-subset staleness · unit coverage gates
(doc 11 §1) · npm audit high · osv-scanner · cargo audit · Playwright smoke.

## 5. Secrets inventory (repo → Actions secrets)

| Secret | Used by |
|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | web deploy |
| `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | desktop updater artifacts |
| `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | APK signing |
| `GPG_PRIVATE_KEY_B64`, `GPG_PASSPHRASE` | SHA256SUMS.asc |

Key generation & offline backup procedure: doc 13 §2. No secret is ever
echoed; workflows use `add-mask` conventions from the ops repo.

## 6. Scheduled workflows

- **Renovate** (ops-repo config): weekly grouped dependency PRs.
- **`link-check.yml`** weekly: `lychee` over `links.*` extracted from
  `data/quotes/**` → opens/updates a single "Dead attribution links" issue.
- **`tzdata-refresh.yml`** quarterly: rerun `gen:tzmap`, PR if diff.

## 7. Caching & speed

npm cache keyed on lockfile; `rust-cache` for Cargo (per-OS); Gradle cache
for Android. Target: `quality`+`web` PR feedback < 6 min; full release
< 35 min.

## 8. Ops-repo change request (to implement alongside this project)

Add `tauri-multiplatform.yml` with inputs `{ mode: ci|release }`, the job set
above, all actions SHA-pinned, and `permissions` declared **inside** the
reusable workflow as well (defense in depth with the caller stub).
