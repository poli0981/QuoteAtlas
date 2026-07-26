# QuoteAtlas

An offline-first, privacy-first **ambient quote display**. It shows one fully
attributed proverb or quotation — matched to your region, with a live clock and
regional calendar, and holiday-aware selection — over a background you customize
(color, gradient, image, video, slideshow). One React core ships as a web PWA and
as desktop + Android apps via Tauri 2. **No backend. No telemetry. Offline-first.**

> **Status:** in active development. The web app is live at
> **<https://qouteatlas.app/>**; Android APKs and desktop bundles for Windows,
> macOS and Linux are attached to each
> [release](https://github.com/poli0981/QuoteAtlas/releases).

## Installing

The Android APK is signed. **The desktop bundles are not** — there is no
code-signing certificate — so the OS will warn about them:

- **Windows** (`.exe`, NSIS installer): SmartScreen shows "Windows protected your
  PC" → _More info_ → _Run anyway_.
- **macOS** (`.dmg`, universal): Gatekeeper refuses a double-click → right-click
  the app → _Open_ → _Open_.
- **Linux**: `.AppImage` (`chmod +x`, then run), `.deb`, or `.rpm`.

Check what you downloaded against the `SHA256SUMS` file on the release before
trusting any of it.

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
<contact@qouteatlas.app>; removal lands in the next release, no questions asked.
See [`legal/DISCLAIMER.md`](legal/DISCLAIMER.md).

## Security

Report vulnerabilities privately — see [`SECURITY.md`](SECURITY.md).

## Development

```bash
npm ci
npm run dev        # local web app
npm run test       # unit tests
npm run build      # production build (PWA)
```

Full command list is in `package.json`.

## Design docs

The full project specification lives in [`docs/`](docs/) — it is the source of
truth the code is written against, and the `docs/NN §N` references scattered
through the source point into it.

| Doc                                                                                                                                       | Covers                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`00_PROJECT_OVERVIEW.md`](docs/00_PROJECT_OVERVIEW.md)                                                                                   | Identity, platforms, doc map                             |
| [`01_TECH_STACK.md`](docs/01_TECH_STACK.md) · [`02_ARCHITECTURE.md`](docs/02_ARCHITECTURE.md)                                             | Versions, "one core, three shells", source tree          |
| [`03_DATA_FLOW.md`](docs/03_DATA_FLOW.md) · [`04_DATA_FORMATS.md`](docs/04_DATA_FORMATS.md) · [`05_ALGORITHMS.md`](docs/05_ALGORITHMS.md) | Boot flow, JSON schemas, media caps, PRNG/calendar maths |
| [`06_UI.md`](docs/06_UI.md) · [`07_I18N.md`](docs/07_I18N.md)                                                                             | Screens, tokens, keyboard map, language axes             |
| [`08_PLATFORM_COMPLIANCE.md`](docs/08_PLATFORM_COMPLIANCE.md) · [`09_SECURITY_PRIVACY.md`](docs/09_SECURITY_PRIVACY.md)                   | Store/PWA requirements, threat model, CSP                |
| [`10_CODING_STANDARDS.md`](docs/10_CODING_STANDARDS.md) · [`11_TESTING.md`](docs/11_TESTING.md)                                           | Strictness rules, coverage gates                         |
| [`12_CI_CD.md`](docs/12_CI_CD.md) · [`13_RELEASE_PUBLISHING.md`](docs/13_RELEASE_PUBLISHING.md)                                           | Job graph, signing keys, channels                        |
| [`14_LEGAL_GATE.md`](docs/14_LEGAL_GATE.md) · [`15_ROADMAP.md`](docs/15_ROADMAP.md)                                                       | Consent gate, legal drafts, phases + decision log        |

[`CLAUDE.md`](CLAUDE.md) is the short version: the hard rules (R1–R12) every
change is held to.

> The docs describe the intended design and are not always in step with what has
> shipped — where they disagree with the code, the code is what runs.
