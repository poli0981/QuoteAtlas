# 10 — Coding Standards

## 1. TypeScript

- `tsconfig`: `strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`, `verbatimModuleSyntax: true`,
  `erasableSyntaxOnly: true` (keeps the codebase TS-7-native ready),
  `target: ES2022`, `moduleResolution: bundler`.
- No `any` (`unknown` + narrowing); no non-null `!` outside tests; no enums
  (use `as const` unions — also required by `erasableSyntaxOnly`).
- Errors: throw `QaError` subclasses with a `code` from the registry
  (doc 02 §6); never throw strings.
- Domain modules (engine, calendars, holidays, attribution, compressor
  ladder) import **no** DOM/Tauri/React — enforced by `import/no-restricted-
  paths` boundaries; `fetch` allowed only under `features/updater/`
  (custom lint rule, doc 02 §7).

## 2. React

- Function components only; hooks-first; no default exports except route
  components (aligns with knip config).
- State: Zustand slices per feature (`useSettings`, `useLibrary`); component
  state only for ephemeral UI. No context-for-state duplication.
- Effects minimal; derive, don't sync. Every `useEffect` carries a one-line
  "why" comment.
- All user-visible strings via i18next keys — literal UI strings fail review.
- Styling: Tailwind utilities + `@theme` tokens; no inline `style` except
  dynamic user values (colors, scrim %). **Physical direction utilities
  banned in `src/`** (`pl-* pr-* left-* …`) — logical only (doc 07 §6).

## 3. File & naming conventions

kebab-case files (`log-buffer.ts`), PascalCase components (`QuoteView.tsx`),
camelCase functions, `SCREAMING_SNAKE` constants. Code prefix `Qa` for
cross-cutting classes (`QaError`). Tests colocated: `engine.test.ts` next to
`engine.ts`; fixtures under `fixtures/`.

## 4. Formatting & hygiene (the "no stray characters" rules)

- **EditorConfig**: UTF-8 **without BOM**, LF, final newline, trim trailing
  whitespace, 2-space indent (4 for Rust via rustfmt).
- **Prettier 3** (+ `prettier-plugin-tailwindcss` class sorting) is the only
  formatter; CI runs `prettier --check`.
- **ESLint 9** flat config: `typescript-eslint` `strictTypeChecked` +
  `stylisticTypeChecked`, `react-hooks`, `jsx-a11y`, boundaries rule (§1).
- **knip**: dead exports / orphan files / unused deps — CI-blocking.
- No commented-out code in `main`; TODOs must reference an issue
  (`// TODO(#12): …`).

## 5. Rust (`src-tauri`)

`rustfmt` defaults · `clippy -D warnings` · `cargo-machete` for unused deps ·
keep the shell thin: window/bundle/plugin wiring only, no business logic
(doc 02 §2). `rust-toolchain.toml` pins the stable channel.

## 6. Data files

Schema-first: edit `data/**` only in ways that pass `scripts/validate-data.ts`
locally (`npm run validate:data`). Quote ids are append-only (never reuse a
deleted id — history rings reference them). Generated files
(`public/fonts/*.woff2`, `tz-to-country.json`, `ATTRIBUTIONS.md`) carry a
`<!-- generated -->` header and are only changed via their scripts.

## 7. Commits & branches

Conventional Commits (`feat: … fix: … data: … docs: … chore: …` — `data:` is
a project-specific type for quote/holiday content). `main` protected; work in
short-lived branches; PR template includes the content-policy checklist for
`data:` changes (doc 14 §6).

## 8. Comments & docs language

Code comments, commit messages, and this suite: **English**. User-facing
strings: via i18n (EN/VI/JA). Keep public function JSDoc for everything under
`lib/` and domain modules.

## 9. Scripts (package.json contract)

```
dev · build · preview
tauri:dev · tauri:build · tauri:android:dev · tauri:android:build
lint (eslint) · format (prettier -w) · typecheck (tsc --noEmit)
knip · validate:data · subset:fonts · gen:attributions · gen:tzmap
test · test:watch · coverage · e2e (playwright)
```

CI calls exactly these — no inline shell logic in workflows (doc 12 §2).
