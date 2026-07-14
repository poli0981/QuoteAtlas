# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub's **"Report a vulnerability"**
(Security → Advisories) on this repository — do **not** open a public issue for
security problems.

Response targets (docs/09 §7):

- Acknowledge within **7 days**.
- A fix or mitigation plan within **30 days** for High-severity or above.

There is no bounty program.

## Release verification

Desktop update packages are signed with **minisign** (public key baked into the
binary); Android APKs are signed and published with `SHA256SUMS` (+ a GPG
`SHA256SUMS.asc`). The release GPG key fingerprint is «gpg-fingerprint» _(to be
published before the first signed release, docs/13 §2)_.

## Scope

QuoteAtlas is offline-first with no backend. The attack surface is (1) the update
channel, (2) user-supplied media files, (3) the supply chain, (4) the web host —
see `docs/09` (maintainer-internal) for the full threat model.
