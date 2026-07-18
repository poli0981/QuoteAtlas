# QuoteAtlas

An offline-first, privacy-first **ambient quote display**. It shows one fully
attributed proverb or quotation — matched to your region, with a live clock and
regional calendar, and holiday-aware selection — over a background you customize
(color, gradient, image, video, slideshow). One React core ships as a web PWA and
(later) desktop + Android via Tauri 2. **No backend. No telemetry. Offline-first.**

> **Status:** in active development — no public release yet.

## Privacy & data

QuoteAtlas collects **no personal data** (no accounts, analytics, telemetry, ads,
or cookies). The only optional network call is an Android update check to
`api.github.com` (the desktop build makes no network call). See
[`legal/PRIVACY.md`](legal/PRIVACY.md).

## Licensing

- **Source code:** GPL-3.0 — see [`LICENSE`](LICENSE).
- **Data set** (`data/`): mixed — self-authored curation/translations are CC0;
  third-party quoted lines remain their owners'. See
  [`LICENSE-DATA.md`](LICENSE-DATA.md).
- [`legal/EULA.md`](legal/EULA.md) · [`legal/DISCLAIMER.md`](legal/DISCLAIMER.md)
  · [`legal/THIRD_PARTY_NOTICES.md`](legal/THIRD_PARTY_NOTICES.md) ·
  [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md)

The names "QuoteAtlas" and "SkullMute" and any logos are **not** licensed — forks
must rebrand for public distribution.

## Content & takedown policy

Quotes are short (≤ 300 chars), fully attributed with a reputable link, and never
song lyrics. Rights holders may request removal at any time via a GitHub issue or
the contact in [`legal/DISCLAIMER.md`](legal/DISCLAIMER.md); removal lands in the
next release, no questions asked.

## Security

Report vulnerabilities privately — see [`SECURITY.md`](SECURITY.md).

## Development

```bash
npm ci
npm run dev        # local web app
npm run test       # unit tests
npm run build      # production build (PWA)
```

Full command list is in `package.json`. Maintainer-internal design docs live in
`docs/` (not part of the published package).
