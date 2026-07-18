# Third-Party Notices — QuoteAtlas

QuoteAtlas is licensed under GPL-3.0 (`LICENSE`). It bundles or builds on the
third-party components below. Update this file whenever a runtime dependency
changes (CLAUDE.md R5). A full transitive list is produced by the build tooling.

| Component                                                                                      | License                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| React, React DOM, Vite (+ @vitejs/plugin-react), Tailwind CSS (+ @tailwindcss/vite), Zustand   | MIT                                              |
| i18next, react-i18next                                                                         | MIT                                              |
| vite-plugin-pwa (+ Workbox)                                                                    | MIT                                              |
| AJV (+ ajv-formats), subset-font _(build/CI only)_                                             | MIT                                              |
| date-holidays                                                                                  | ISC                                              |
| Tauri 2 + `@tauri-apps/api` + plugins (os, store, fs, opener) _(desktop/Android)_              | MIT OR Apache-2.0                                |
| Fonts: Be Vietnam Pro, Lora, Noto Serif JP / SC / TC / KR _(+ later Naskh Arabic, Serif Thai)_ | SIL OFL 1.1                                      |
| Rust crates (transitive, `src-tauri`)                                                          | MIT / Apache-2.0 — full list via `cargo license` |

Attributions for the quoted content in `data/` are tracked separately in
`ATTRIBUTIONS.md`; data licensing is described in `LICENSE-DATA.md`.
