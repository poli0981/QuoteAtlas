# Quotes & Proverbs Dataset — v1.0 · Schema & Quy ước

> File này là **contract** cho 3 file dữ liệu còn lại. Đọc file này trước khi import.

---

## 1. Locale hỗ trợ (v1)

| Code | Ngôn ngữ | Ghi chú |
|---|---|---|
| `en` | English | Ngôn ngữ nguồn của Nhóm A & C |
| `vi` | Tiếng Việt | |
| `ja` | 日本語 | |
| `ko` | 한국어 | |
| `zh-Hans` | 简体中文 | Đại lục |
| `zh-Hant` | 繁體中文 | Đài Loan / Hồng Kông |

---

## 2. Ba nhóm dữ liệu

| Nhóm | File | Nguồn | Dịch? | Neo vào |
|---|---|---|---|---|
| **A** — Ngày lễ quốc tế | `01-international-holidays.md` | `en` | ✅ 6 locale | `holiday_id` |
| **B** — Tục ngữ bản địa | `02-native-proverbs.md` | Bản ngữ | ❌ nguyên văn | `holiday_id` |
| **C** — Quote truyền cảm hứng | `03-inspirational-quotes.md` | `en` | ✅ 6 locale | `theme` |

---

## 3. Schema đề xuất (JSON)

```jsonc
// Nhóm A & C — có bản dịch
{
  "id": "INT-NEWYEAR-01",
  "group": "A",                    // "A" | "B" | "C"
  "holiday_id": "int.new_year",    // null với nhóm C
  "theme": ["new_beginning"],      // dùng cho nhóm C, optional cho A
  "author": "Ralph Waldo Emerson",
  "author_status": "PD",           // "PD" | "IN_COPYRIGHT" | "ANON"
  "source": "Society and Solitude (1870)",
  "source_url": null,              // ⚠️ BẮT BUỘC nếu author_status === "IN_COPYRIGHT" — xem mục 9
  "translation_mode": "literal",   // "literal" | "equivalent" — xem mục 13
  "verified": true,                // false = chưa truy được nguồn gốc
  "text": {
    "en": "...", "vi": "...", "ja": "...",
    "ko": "...", "zh-Hans": "...", "zh-Hant": "..."
  }
}

// Nhóm B — KHÔNG dịch
{
  "id": "VN-TET-01",
  "group": "B",
  "holiday_id": "vn.tet_nguyen_dan",
  "locale": "vi",                  // ngôn ngữ nguyên văn
  "native_only": true,             // ⚠️ xem mục 5
  "kind": "ca_dao",                // ca_dao | tuc_ngu | kotowaza | sokdam | yanyu | rhyme
  "text": "Thịt mỡ dưa hành câu đối đỏ / Cây nêu tràng pháo bánh chưng xanh"
}
```

---

## 4. Quy ước ID

```
Nhóm A:  INT-{HOLIDAY}-{NN}     → INT-NEWYEAR-01
Nhóm B:  {CC}-{HOLIDAY}-{NN}    → VN-TET-01, JP-OBON-03
Nhóm C:  INS-{THEME}-{NN}       → INS-PERSEVERANCE-05
```

`{CC}` = `UK` · `VN` · `JP` · `KR` · `CN`

---

## 5. ⚠️ `native_only` — quyết định cần chốt trước khi code random picker

Nhóm B không có bản dịch. Nếu app bắn ca dao Việt ra cho người đang để UI tiếng Hàn, họ **nhìn không hiểu gì**.

Mặc định trong dataset này: `native_only: true` → chỉ hiện khi `ui_locale === entry.locale`.

Pseudo-code cho picker:

```js
const pool = entries.filter(e =>
  e.group !== 'B' ? true : (e.native_only ? e.locale === uiLocale : true)
);
```

Nếu muốn "khoe" tục ngữ nước khác cho mọi locale → set `native_only: false` cho entry đó, nhưng lúc đó nên cân nhắc bổ sung gloss ở v1.1.

---

## 6. ⚠️ Lịch âm — KHÔNG hardcode ngày dương

Rất nhiều lễ ở Nhóm B trôi ngày dương mỗi năm. Registry dưới đây lưu **ngày theo lịch gốc**, app tự convert lúc runtime (gợi ý: `lunar-javascript`, `chinese-lunar-calendar`, hoặc `@date-fns/tz` + bảng tra).

### Registry — Nhóm A (ngày lễ quốc tế)

| holiday_id | Tên | Ngày | calendar |
|---|---|---|---|
| `int.new_year` | New Year's Day | 01-01 | gregorian |
| `int.valentine` | Valentine's Day | 02-14 | gregorian |
| `int.womens_day` | International Women's Day | 03-08 | gregorian |
| `int.easter` | Easter Sunday | movable | computus |
| `int.mothers_day` | Mother's Day | CN thứ 2 tháng 5 (US/VN/JP) | rule |
| `int.fathers_day` | Father's Day | CN thứ 3 tháng 6 | rule |
| `int.halloween` | Halloween | 10-31 | gregorian |
| `int.thanksgiving` | Thanksgiving | Thứ 5 thứ 4 tháng 11 (US) | rule |
| `int.christmas` | Christmas | 12-25 | gregorian |
| `int.nye` | New Year's Eve | 12-31 | gregorian |

> `int.mothers_day` và `int.thanksgiving` khác nhau theo nước (UK Mothering Sunday, Canada Thanksgiving tháng 10). v1 dùng rule US/quốc tế phổ biến.

### Registry — Nhóm B (lễ bản địa)

| holiday_id | Tên | Ngày | calendar |
|---|---|---|---|
| `uk.burns_night` | Burns Night | 01-25 | gregorian |
| `uk.pancake_day` | Shrove Tuesday | Easter − 47 ngày | computus |
| `uk.st_george` | St George's Day | 04-23 | gregorian |
| `uk.bonfire_night` | Bonfire Night | 11-05 | gregorian |
| `uk.boxing_day` | Boxing Day | 12-26 | gregorian |
| `vn.tet_nguyen_dan` | Tết Nguyên Đán | 01-01 | **lunar** |
| `vn.tet_han_thuc` | Tết Hàn Thực | 03-03 | **lunar** |
| `vn.gio_to_hung_vuong` | Giỗ Tổ Hùng Vương | 03-10 | **lunar** |
| `vn.tet_doan_ngo` | Tết Đoan Ngọ | 05-05 | **lunar** |
| `vn.vu_lan` | Lễ Vu Lan | 07-15 | **lunar** |
| `vn.tet_trung_thu` | Tết Trung Thu | 08-15 | **lunar** |
| `vn.ong_tao` | Ông Công Ông Táo | 12-23 | **lunar** |
| `jp.oshogatsu` | お正月 | 01-01 | gregorian |
| `jp.setsubun` | 節分 | ~02-03 | **solar term** |
| `jp.hinamatsuri` | ひな祭り | 03-03 | gregorian |
| `jp.kodomo_no_hi` | こどもの日 | 05-05 | gregorian |
| `jp.tanabata` | 七夕 | 07-07 | gregorian ⚠️ |
| `jp.obon` | お盆 | 08-13→15 | gregorian ⚠️ |
| `jp.tsukimi` | 月見 | 08-15 | **lunar** |
| `kr.seollal` | 설날 | 01-01 | **lunar** |
| `kr.daeboreum` | 정월대보름 | 01-15 | **lunar** |
| `kr.dano` | 단오 | 05-05 | **lunar** |
| `kr.chuseok` | 추석 | 08-15 | **lunar** |
| `kr.hangul_day` | 한글날 | 10-09 | gregorian |
| `cn.chunjie` | 春節 | 01-01 | **lunar** |
| `cn.yuanxiao` | 元宵節 | 01-15 | **lunar** |
| `cn.qingming` | 清明節 | ~04-05 | **solar term** |
| `cn.duanwu` | 端午節 | 05-05 | **lunar** |
| `cn.qixi` | 七夕 | 07-07 | **lunar** |
| `cn.zhongqiu` | 中秋節 | 08-15 | **lunar** |
| `cn.chongyang` | 重陽節 | 09-09 | **lunar** |

### ⚠️ Ba cái bẫy về ngày

1. **お盆** — đa số Nhật làm **13–15/8 dương**, nhưng Tokyo và một số vùng làm **13–15/7 dương**, vài nơi vẫn theo âm (旧盆). Cần field `region_variant` nếu muốn chính xác.
2. **七夕** — Nhật đã chuyển sang **7/7 dương**; Trung Quốc vẫn **7/7 âm**. Hai lễ khác ngày dù cùng gốc → **2 holiday_id riêng**, đúng như registry trên.
3. **清明 / 節分** — theo **tiết khí**, không phải âm cũng không phải dương thuần. Trôi 4–5/4 và 2–4/2 tuỳ năm. Đừng hardcode.

---

## 7. ⚠️ Trùng ngày ≠ trùng lễ

| Cùng ngày | Nhưng là | Xử lý |
|---|---|---|
| Mùng 1 tháng Giêng âm | `vn.tet_nguyen_dan` · `cn.chunjie` · `kr.seollal` | **3 entry riêng**, tục ngữ khác nhau hoàn toàn |
| 15/8 âm | `vn.tet_trung_thu` · `cn.zhongqiu` · `kr.chuseok` · `jp.tsukimi` | **4 entry riêng** |
| 5/5 âm | `vn.tet_doan_ngo` · `cn.duanwu` · `kr.dano` | **3 entry riêng** |

Đừng merge. Nội hàm văn hoá khác nhau (VD Chuseok là lễ tạ ơn mùa màng, Trung Thu VN là tết thiếu nhi, 中秋 TQ là đoàn viên).

---

## 8. ⚠️ zh-Hans / zh-Hant

- **Nhóm A & C**: chỉ là biến thể chữ viết → convert được bằng [OpenCC](https://github.com/BYVoid/OpenCC). **Nhưng vẫn phải review tay** vì có khác biệt từ vựng ngoài chữ (`软件`/`軟體`, `信息`/`資訊`, `视频`/`影片`).
- **Nhóm B**: dataset này coi `zh-Hant` là **biến thể chữ viết của cùng kho tục ngữ Hán**, tục ngữ cổ điển dùng chung cả hai vùng.
- **Chưa làm ở v1**: lễ riêng của Đài Loan (`雙十節` 10/10) và Hồng Kông. Nếu muốn tách Đài Loan thành quốc gia riêng → thêm `TW-*` ở v1.1.

---

## 9. ⚠️ Bản quyền & sai tác giả

| `author_status` | Nghĩa | Rủi ro |
|---|---|---|
| `PD` | Public domain (tác giả mất >70 năm, hoặc cổ đại) | Không |
| `ANON` | Tục ngữ, ca dao, vè dân gian — vô danh | Không |
| `IN_COPYRIGHT` | Tác giả còn trong thời hạn bảo hộ | Câu ngắn thường an toàn, **nên rà lại nếu thương mại hoá** |

**Dataset này ưu tiên `PD` và `ANON`.** Nhóm C hầu như toàn PD.

### Quy tắc link cho entry còn bản quyền

Mỗi entry `author_status: "IN_COPYRIGHT"` **bắt buộc có `source_url`** — link tới một trang trích dẫn đúng nguyên văn + tác giả. Lý do: câu trích ngắn thường thuộc *fair use*, nhưng có nguồn dẫn minh bạch giúp (1) chứng minh xuất xứ, (2) tránh chính mình lặp lại lỗi sai tác giả, (3) giảm rủi ro nếu ai đó khiếu nại.

Ưu tiên link: trang fact-check (Snopes, Quote Investigator) > trang tra cứu có ghi rõ tác phẩm + trang sách > trang tổng hợp quote chung chung (BrainyQuote… — tránh, vì hay sai attribution).

Ở v1 **chỉ có đúng 1 entry** rơi vào diện này: `INS-SUCCESS-01` (Will Durant, mất 1981). Đã gắn `source_url`. Xem file `03`.

**Bẫy lớn nhất — sai tác giả.** Rất nhiều quote lưu hành trên mạng bị gán bừa. Các câu **đã bị loại khỏi dataset** vì không truy được nguồn:

| Câu | Bị gán cho | Thực tế |
|---|---|---|
| "Be yourself; everyone else is already taken." | Oscar Wilde | Không có trong bất kỳ tác phẩm nào của Wilde |
| "Insanity is doing the same thing over and over…" | Einstein | Xuất hiện sau khi Einstein mất; nguồn sớm nhất ~1981 |
| "Every new beginning comes from some other beginning's end." | Seneca | Là lời bài hát *Closing Time* của Semisonic (1998) |
| "The only thing necessary for the triumph of evil…" | Edmund Burke | Không có trong toàn tập Burke |
| "Be the change you wish to see in the world." | Gandhi | Paraphrase; nguyên văn Gandhi dài và khác hẳn |

→ Field `verified: true` nghĩa là **đã truy được về tác phẩm/nguồn cụ thể**. Đừng bỏ field này khi import.

---

## 10. Quy ước nội dung Nhóm B

Không phải lễ nào cũng có đủ 8 câu tục ngữ **nhắc đích danh tên lễ** — thực tế không tồn tại. Ví dụ Giỗ Tổ Hùng Vương chỉ có 1–2 câu ca dao gọi tên trực tiếp.

→ Quy ước: mỗi lễ gồm **câu gọi tên trực tiếp** (nếu có) + **tục ngữ cùng chủ đề của lễ đó**. Ví dụ:
- `vn.gio_to_hung_vuong` → câu gọi tên + tục ngữ về **cội nguồn, biết ơn**
- `vn.vu_lan` → tục ngữ về **hiếu thảo, công ơn cha mẹ**
- `cn.qingming` → 谚语 gọi tên + 农谚 về **tiết Thanh Minh**

Field `kind` phân biệt loại. Nếu bạn chỉ muốn câu gọi tên trực tiếp → lọc theo `kind` + tự đánh thêm flag `direct_mention`.

---

## 11. Thống kê v1

| Nhóm | File | Số lễ / chủ đề | Câu/mục | Entry gốc | Row sau dịch |
|---|---|---|---|---|---|
| A | `01` | 10 lễ | 8 | 80 | 480 |
| B | `02a` | UK 5 + VN 7 = 12 lễ | 8 | 96 | 96 (không dịch) |
| B | `02b` | JP 7 + KR 5 + CN 7 = 19 lễ | 8 | 152 | 152 (không dịch) |
| C | `03` | 8 chủ đề | 8 | 64 | 384 |
| **Tổng** | | **31 lễ + 8 chủ đề** | | **392** | **1.112** |

Phân bố bản quyền: Nhóm A và B là `PD`/`ANON` 100%. Nhóm C là **63 `PD` + 1 `IN_COPYRIGHT`** (`INS-SUCCESS-01` — Will Durant, đã gắn `source_url`). Không còn entry bản quyền nào khác. Toàn bộ vẫn thoải mái thương mại hoá; entry Durant nếu khắt khe thì bỏ được (xem file `03`).

---

## 12. Backlog v1.1+

- [ ] Gloss/phiên âm cho Nhóm B (đã chốt v1 là **không**, nhưng user Nhật xem ca dao Việt vẫn là vấn đề mở)
- [ ] Tách Đài Loan (`TW-*`) + lễ riêng 雙十節
- [ ] `region_variant` cho お盆 (Tokyo 7/8 vs toàn quốc 8/8)
- [ ] Bổ sung lễ: Earth Day, Labour Day 1/5, Children's Day 1/6, Teacher's Day
- [ ] Nhóm B cho các lễ VN còn thiếu: 30/4, 2/9, 20/10, 20/11
- [ ] Audit lại toàn bộ `verified: false` (nếu có)

---

## 13. Chiến lược dịch — `translation_mode`

Đã chốt: **ưu tiên câu tương đương bản ngữ** (`equivalent`) thay vì dịch sát từng chữ. Nhưng quy tắc này chỉ áp dụng được cho một loại câu. Phân biệt:

| Loại câu nguồn | `translation_mode` | Cách xử lý |
|---|---|---|
| **Tục ngữ / thành ngữ vô danh** (ANON) | `equivalent` | Nếu ngôn ngữ đích có **tục ngữ tương đương phổ biến** → dùng luôn tục ngữ đó, không dịch chữ. VD "Speak of the devil" → 说曹操曹操到 / 噂をすれば影 / 호랑이도 제 말 하면 온다. |
| **Câu có tác giả cụ thể** (Shakespeare, Seneca, Khổng Tử…) | `literal` | **Dịch trung thành**. Không thay bằng tục ngữ khác — vì cột `author` gắn với chính câu chữ đó; thay câu là phá attribution. "Dịch trung thành" ở đây tự nó đã là bản *tương đương về nghĩa*. |
| **Câu tác giả gốc Trung Hoa** | `literal` (giữ nguyên Hán văn) | Cột `zh` để **nguyên bản chữ Hán**, không dịch ngược từ tiếng Anh. VD 見義不為，無勇也 (Khổng Tử). Đã làm sẵn ở Nhóm C. |

**Điểm quan trọng:** bản tương đương **được phép khác nhau giữa các ngôn ngữ trong cùng một entry**. Ngôn ngữ nào có tục ngữ khớp thì dùng, ngôn ngữ nào không có thì dịch sát. Đây là chủ ý, không phải lỗi thiếu nhất quán.

⚠️ **Cạm bẫy khi thay tục ngữ:** phải giữ đúng nghĩa. VD "Absence makes the heart grow fonder" (xa càng nhớ) **không** được thay bằng 「안 보면 멀어진다」của Hàn — câu đó nghĩa **ngược lại** (xa mặt cách lòng). Khi không có tục ngữ khớp *chính xác nghĩa*, giữ bản dịch sát còn hơn thay bừa.

### Các entry Nhóm A đã dùng bản tương đương ở v1

| ID | Câu nguồn | Ngôn ngữ dùng tục ngữ tương đương |
|---|---|---|
| INT-NEWYEAR-05 | Well begun is half done | ko 시작이 반이다 · zh 好的开始是成功的一半 |
| INT-NEWYEAR-08 | The first step is the hardest | zh 万事开头难 |
| INT-EASTER-03 | After winter comes spring | ja 冬来たりなば春遠からじ · ko 고생 끝에 낙이 온다 · zh 冬去春来 |
| INT-FATHERSDAY-03 | Like father, like son | ja 蛙の子は蛙 · zh 有其父必有其子 |
| INT-HALLOWEEN-05 | Speak of the devil | ja 噂をすれば影 · ko 호랑이도 제 말 하면 온다 · zh 说曹操，曹操到 |
| INT-THANKSGIVING-05 | Enough is as good as a feast | ja 足るを知る者は富む · ko 족함을 아는 자가 부자다 · zh 知足常乐 |
| INT-VALENTINE-08 | Love is blind | vi Yêu nhau củ ấu cũng tròn · ja 恋は盲目 · zh 情人眼里出西施 |
| INT-NYE-05 | Better late than never | ko 늦었다고 생각할 때가 가장 빠른 때 |

Các câu tục ngữ ANON còn lại: nếu ngôn ngữ đích chưa có tục ngữ khớp thì đang để **dịch sát tự nhiên** — vẫn đọc trôi, chỉ là chưa "đóng khuôn" thành tục ngữ. Có thể nâng dần ở các bản sau.
