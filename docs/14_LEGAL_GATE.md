# 14 — Legal Gate & Legal Documents

This doc specifies the gate mechanism, the content-rights policy, and carries
**ready-to-commit drafts** for `legal/EULA.md`, `legal/DISCLAIMER.md`,
`legal/PRIVACY.md`, `LICENSE-DATA.md`, plus templates for
`legal/THIRD_PARTY_NOTICES.md` and `ATTRIBUTIONS.md`.
The contact placeholders are filled: the public contact address is
`contact@qouteatlas.app` (Cloudflare Email Routing). GPL-3.0 full text
(gnu.org, verbatim) goes into `LICENSE` — done, doc 00 §8.

## 1. Gate mechanism (spec)

Blocking modal on first run/visit (UI in doc 06 §10). Constant
`LEGAL_VERSION` (integer) lives beside the legal docs; consent stores
`{ consentVersion, at }`. Any material change to legal texts ⇒ bump ⇒ re-gate.
Links go to the GitHub-rendered files (per the original requirement) — the
gate itself stays short. Declining = the app simply does not proceed
(close/leave); GPL rights over the *source code* are unaffected by the gate.

## 2. Licensing layers (normative)

| Layer | License |
|---|---|
| Source code | **GPL-3.0** (`LICENSE`) |
| Self-authored data: quote selection/curation, own translations, metadata, holiday overrides | **CC0 1.0** (`LICENSE-DATA.md`) |
| Third-party quoted lines (movie/game/book/quotations under copyright) | Remain the property of their respective owners; included as short attributed quotations |
| Fonts | SIL OFL 1.1 (per-font notices) |

The GPL applies no additional restrictions and this project adds none
(GPLv3 §7 respected — the EULA below is deliberately non-restrictive).

## 3. Content-rights policy (binding for every `data:` PR)

1. Quotes are **short**: ≤ 1–2 sentences, ≤ 300 chars (CI-enforced length).
2. Always fully attributed with a reputable link per doc 04 §5–6.
3. **Never song lyrics.** Never poem excerpts beyond a proverb-length line.
4. No logos, stills, artwork, or trademarks of the quoted works.
5. Translations: write our own (→ CC0) or use verifiably PD/CC sources.
6. PR checklist (template): type-correct fields · link on allowlist · rights
   value justified · no lyrics · contributor agrees their original text is
   dedicated under CC0.
7. **Takedown:** owners may request removal via GitHub issue or contact@qouteatlas.app;
   removal lands in the next release, no questions asked. Stated publicly in
   README + Disclaimer.

## 4. Draft — `legal/PRIVACY.md` (bilingual)

> **Privacy Policy — QuoteAtlas** (v1, 2026)
>
> **EN ·** QuoteAtlas collects **no personal data**. There are no accounts,
> no analytics, no telemetry, no ads, no cookies. Everything you configure
> (settings, favorites, background media) is stored **only on your device**
> and never transmitted — there is no server to send it to.
> Network connections: (1) on desktop/Android, an optional update check
> contacts `api.github.com` (GitHub then sees your IP address per
> [GitHub's Privacy Statement]); you can disable it in Settings. (2) The web
> version is served by Cloudflare Pages, whose standard server logs are
> governed by Cloudflare's privacy policy. (3) Attribution links open in your
> browser only when you tap them.
> Uninstalling the app / clearing site data deletes everything.
> Contact: contact@qouteatlas.app.
>
> **VI ·** QuoteAtlas **không thu thập dữ liệu cá nhân**. Không tài khoản,
> không analytics, không telemetry, không quảng cáo, không cookie. Mọi thứ
> bạn thiết lập (cài đặt, mục yêu thích, ảnh/video nền) chỉ lưu **trên thiết
> bị của bạn** và không bao giờ được gửi đi — dự án không có máy chủ.
> Kết nối mạng: (1) trên desktop/Android, tính năng kiểm tra cập nhật (tắt
> được trong Cài đặt) gọi tới `api.github.com` — GitHub thấy địa chỉ IP của
> bạn theo chính sách riêng tư của GitHub; (2) bản web được phục vụ bởi
> Cloudflare Pages với log máy chủ tiêu chuẩn theo chính sách của Cloudflare;
> (3) các liên kết nguồn chỉ mở khi bạn chủ động bấm.
> Gỡ ứng dụng / xóa dữ liệu trang là xóa toàn bộ. Liên hệ: contact@qouteatlas.app.

## 5. Draft — `legal/DISCLAIMER.md` (bilingual)

> **EN ·** QuoteAtlas is provided **"as is"**, without warranty of any kind,
> as stated in GPL-3.0 §15–16. Quotes, translations, attributions, holiday
> data and calendar computations are provided on a best-effort basis and may
> contain errors; nothing here is professional advice. Movie, game and
> literary quotations remain the property of their respective owners; their
> inclusion as short, attributed quotations does not imply any affiliation
> with or endorsement by those owners. Rights holders may request removal at
> any time (contact@qouteatlas.app or a GitHub issue) — see the takedown policy.
> Repository documentation was produced with AI assistance and human review;
> this disclosure covers documentation only.
>
> **VI ·** QuoteAtlas được cung cấp **"nguyên trạng"**, không kèm bất kỳ bảo
> đảm nào (GPL-3.0 §15–16). Câu trích, bản dịch, thông tin nguồn, dữ liệu
> ngày lễ và phép tính lịch được thực hiện với nỗ lực tốt nhất nhưng có thể
> sai sót; không phải lời khuyên chuyên môn. Trích dẫn phim, game, văn học
> thuộc về chủ sở hữu tương ứng; việc trích ngắn kèm ghi nguồn không hàm ý
> liên kết hay bảo chứng nào từ các chủ sở hữu đó. Chủ sở hữu quyền có thể
> yêu cầu gỡ bất cứ lúc nào (contact@qouteatlas.app hoặc GitHub issue). Tài liệu kho mã
> có sự hỗ trợ của AI kèm rà soát thủ công — công bố này chỉ áp dụng cho tài
> liệu.

## 6. Draft — `legal/EULA.md` (bilingual, deliberately minimal)

> **EN ·** Your use of the QuoteAtlas **source code and binaries** is
> licensed under GPL-3.0 (`LICENSE`); this EULA adds **no further
> restrictions** to your GPL rights. Clarifications only: (1) the name
> "QuoteAtlas", the SkullMute name and any logos are **not** licensed —
> forks must rebrand for public distribution; (2) quoted third-party lines
> in the data set are not relicensed to you (see `LICENSE-DATA.md`);
> (3) warranty disclaimer and liability limits per GPL-3.0 §15–16 and
> `DISCLAIMER.md`.
>
> **VI ·** Việc sử dụng **mã nguồn và bản dựng** QuoteAtlas tuân theo
> GPL-3.0 (`LICENSE`); EULA này **không thêm bất kỳ hạn chế nào** lên các
> quyền GPL của bạn. Chỉ làm rõ: (1) tên "QuoteAtlas", tên SkullMute và logo
> **không** được cấp phép — bản fork phát hành công khai cần đổi nhận diện;
> (2) các câu trích bên thứ ba trong bộ dữ liệu không được tái cấp phép cho
> bạn (xem `LICENSE-DATA.md`); (3) miễn trừ bảo đảm và giới hạn trách nhiệm
> theo GPL-3.0 §15–16 và `DISCLAIMER.md`.

## 7. Draft — `LICENSE-DATA.md`

> The QuoteAtlas data set (`data/`) is **mixed**:
> **(a)** Curation, structure, metadata, holiday overrides, and all
> translations/original lines authored by this project are dedicated to the
> public domain under **CC0 1.0 Universal**
> (creativecommons.org/publicdomain/zero/1.0/ — full legal code linked, not
> reproduced here). Records carry `rights: "cc0"` or `"own-translation"`.
> **(b)** Quoted third-party lines (`rights: "quoted-with-attribution"`)
> remain the property of their respective owners and are included solely as
> short, attributed quotations; they are **not** covered by CC0 or GPL.
> **(c)** Public-domain proverbs/classics carry `rights: "public-domain"`.
> Reuse of (a) requires nothing; reuse of (b) is between you and the rights
> holder.

## 8. `legal/THIRD_PARTY_NOTICES.md` — template

Generated skeleton, updated whenever dependencies change (CLAUDE.md R5):

| Component | License |
|---|---|
| React, Vite, Tailwind CSS, Motion, Zustand, i18next, vite-plugin-pwa/Workbox, AJV, subset-font, browser-image-compression | MIT |
| Tauri + official plugins | MIT OR Apache-2.0 |
| date-holidays | ISC |
| Fonts: Be Vietnam Pro, Lora, Noto Serif JP/SC/TC/KR (+ later Naskh Arabic, Serif Thai) | SIL OFL 1.1 |
| Rust crates (transitive) | MIT/Apache-2.0 — full list via `cargo license` appendix |

## 9. `ATTRIBUTIONS.md` — generated file contract

Header: `<!-- generated by scripts/gen-attributions.ts — do not edit -->` +
takedown pointer. Body: one section per locale, one line per third-party
quote using the markdown templates of doc 04 §5, sorted by work. CI check:
file is regenerated and committed whenever `data/quotes/**` changes.

## 10. In-app About screen

Version · links to all of the above on GitHub · "Reopen legal notice" ·
GPG fingerprint of the release key · takedown contact.
