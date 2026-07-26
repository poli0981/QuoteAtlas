# 08 — Platform Compliance

What each platform requires of us, and what we promise users on each.
(Security config details live in doc 09; signing steps in doc 13.)

## 1. Tauri (desktop + Android shell)

- Capability model: single `capabilities/default.json`, minimum permission
  set (doc 09 §3). Adding any plugin/permission requires a doc 09 update in
  the same PR — hard rule (CLAUDE.md R6).
- No remote URLs in the webview; `app.windows[].url` is the bundled index
  only. Devtools disabled in release builds.
- Updater artifacts enabled (`createUpdaterArtifacts: true`) — desktop only;
  the updater plugin does not exist on mobile, hence the Android flow in §4.
- `single-instance` desktop-only (Android activity model handles it).

## 2. Windows / macOS / Linux specifics

| OS | Reality | What we do |
|---|---|---|
| Windows | Unsigned NSIS installer → SmartScreen warning | README section with exact "More info → Run anyway" steps + SHA-256 verify; code-signing cert = post-v1 cost decision (doc 15) |
| macOS | Unsigned/un-notarized .dmg → Gatekeeper block | README: right-click → Open (or `xattr -dr com.apple.quarantine`); universal binary (aarch64+x64) |
| Linux | AppImage + .deb + .rpm | AppImage is the primary story; no repo/PPA maintenance in v1 |

## 3. Android 12+ sideload model

- **Distribution: GitHub Releases only.** No Play Store in v1.x → no Play
  policy surface; but we self-impose Play-grade hygiene: targetSdk 36,
  16 KB-page-size native libs (NDK r28+), APK signature scheme v2+v3.
- minSdk 31 rationale: System WebView on Android 12+ is evergreen Chromium —
  the whole Option-A bet; also skips legacy storage/permission quirks.
- Permissions: **INTERNET only.** No location, no storage (media handled via
  SAF file picker + app-private dir), no notifications.
- Install UX documented for users (README + in-app help):
  1. Download `quoteatlas-v{x}-android-arm64.apk` from Releases.
  2. Verify SHA-256 against `SHA256SUMS` (app also displays the expected hash
     on the update dialog); optionally verify `SHA256SUMS.asc` (GPG).
  3. Allow "Install unknown apps" for the browser → install.
- The app never downloads APKs itself → no `REQUEST_INSTALL_PACKAGES`
  permission, no foreground-service download code, smaller trust surface.
- **Obtainium compatible** by construction: stable artifact name pattern +
  standard GitHub Releases; document the config snippet in README.

## 4. Android in-app update check contract

Doc 03 §5 flow. Additional compliance notes: respect GitHub unauthenticated
rate limits (ETag caching, ≤ 1 auto check/24 h); show release notes verbatim
from the release body (markdown-rendered, links open externally); "Skip this
version" persists per version tag.

## 5. Web / PWA / Cloudflare Pages

- SPA fallback routing + real `404.html`; `_headers` ships the CSP & friends
  (doc 09 §1) — this capability is why Cloudflare Pages was chosen over
  GitHub Pages.
- PWA: installable manifest (name QuoteAtlas, theme-color from settings
  default), Workbox precache of app shell + quote data + subset fonts →
  full offline after first visit; SW update → reload toast.
- No cookies. localStorage only (consent + settings) — documented in Privacy
  (doc 14 §4); no consent-banner obligations beyond our own legal gate since
  nothing is tracked.
- Cloudflare, as host, sees standard request logs (IP, UA) — disclosed in
  Privacy; we add no beacons of our own.

## 6. Browser support floor (web)

Evergreen Chromium/Firefox/Safari, plus WebView ≥ Android-12 baseline.
Feature gates: OPFS (fallback IndexedDB), `convertToBlob` WebP encode
(fallback: reject with option (1) only — Safari note in doc 11 §4),
`navigator.storage.persist()` best-effort.

## 7. Store-free statement

QuoteAtlas is intentionally not on Chrome Web Store / Play / App Store in
v1.x. If that changes (doc 15 post-v1), a store-compliance doc revision is
required *before* any submission work.
