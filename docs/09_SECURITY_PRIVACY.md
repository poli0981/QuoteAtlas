# 09 — Security & Privacy

Threat posture: a fully offline content app. The attack surface is (1) the
update channel, (2) user-supplied media files, (3) the supply chain, (4) the
web host. Everything below exists to keep those four small.

## 1. Web security headers — `public/_headers` (Cloudflare Pages)

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self';
    img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self';
    connect-src 'self'; worker-src 'self'; manifest-src 'self';
    frame-ancestors 'none'; base-uri 'self'; form-action 'none'; object-src 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Cross-Origin-Opener-Policy: same-origin
```

No third-party origins anywhere → `'self'` holds. Vite 8 emits external
scripts/styles by default; any build change that would require
`unsafe-inline` is a blocking review item. HSTS handled at the Cloudflare
zone level.

## 2. Tauri CSP (`tauri.conf.json → app.security.csp`)

Same as §1 plus `connect-src 'self' https://api.github.com` (updater) and the
asset protocol for local media:
`img-src 'self' asset: blob: data:; media-src 'self' asset: blob:` with
`assetProtocol.scope = ["$APPDATA/backgrounds/**"]`.

## 3. Tauri capabilities — `capabilities/default.json` (the whole file)

```jsonc
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "store:default",
    "dialog:default",
    "opener:default",
    "os:default",
    "process:allow-restart",
    { "identifier": "fs:allow-read-dir",   "allow": [{ "path": "$APPDATA/backgrounds" }] },
    { "identifier": "fs:allow-read-file",  "allow": [{ "path": "$APPDATA/backgrounds/**" }] },
    { "identifier": "fs:allow-write-file", "allow": [{ "path": "$APPDATA/backgrounds/**" }] },
    { "identifier": "fs:allow-remove",     "allow": [{ "path": "$APPDATA/backgrounds/**" }] },
    "updater:default"                       // desktop builds only
  ]
}
```

Rule: this file only ever *shrinks or is justified in-PR*; every addition
updates this doc in the same commit (CLAUDE.md R6).

## 4. Android hardening

`allowBackup="false"` · network-security-config blocks cleartext ·
INTERNET-only permissions · APK signed v2+v3 · NDK r28+ (16 KB pages) ·
release builds strip debug symbols; `minifyEnabled` for the wrapper.

## 5. Update-channel integrity

Desktop packages verified by **minisign** signature (public key baked into
the binary) before install — a compromised GitHub release without the private
key cannot install. Android: user-verified SHA-256 (+ optional GPG on
`SHA256SUMS.asc`) as documented in doc 08 §3. Web: TLS + Cloudflare.
Key handling in doc 13 §2 (private keys never in the repo; CI secrets only).

## 6. Log redaction (bug reports)

Ring buffer entries pass `redact()` before export:
home paths (`C:\Users\<u>`, `/home/<u>`, `/Users/<u>`) → `~` · media file
names → `<media-#hash>` · anything matching an email/URL-with-query →
masked. Buffer never contains quote-favorites or settings values. Reports are
user-initiated only (doc 03 §6).

## 7. Vulnerability reporting

GitHub **private vulnerability reporting** enabled on the repo; response
target: acknowledge ≤ 7 days, fix or mitigation plan ≤ 30 days for High+.
`SECURITY.md` (repo root, human task) points here. No bounty program.

## 8. Supply chain

Lockfiles committed · Renovate weekly · CI gates `npm audit
--audit-level=high` + osv-scanner + `cargo audit` (doc 12 §4) ·
`npm ci --ignore-scripts` in CI install step (scripts re-enabled only for the
explicit build step) · GitHub Actions pinned to commit SHAs ·
`cargo-machete` + knip keep the dependency set minimal · new runtime
dependency = license check (GPL-compatibility) + THIRD_PARTY_NOTICES update
in the same PR (CLAUDE.md R5).

## 9. User-media considerations

Decoding happens in the browser/webview media stack (same code path as any
web page); we add: magic-byte sniffing (no trusting extensions), size caps
before decode, decode inside a Worker for images, and object-URL lifecycle
management (revoke on library delete). Media never leaves the device; never
uploaded anywhere — there is nowhere to upload to.

## 10. Privacy model (normative summary — user-facing text in doc 14 §4)

| Data | Where | Leaves device? |
|---|---|---|
| Settings, favorites, consent, history ring | local storage adapter | Never |
| Media library | OPFS / app-data dir | Never |
| Update check | HTTPS to api.github.com (desktop/Android, optional) | IP/UA visible to GitHub, per GitHub's privacy policy |
| Web hosting | Cloudflare standard logs | IP/UA visible to Cloudflare, per Cloudflare's policy |
| Analytics / telemetry / crash upload | — | **Does not exist** |
