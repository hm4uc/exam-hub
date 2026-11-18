# Research 01: MathType, Equation và hình học trong .docx lên web

Phiếu: `.scratch/exam-hub/issues/01-mathtype-hinh-hoc-docx.md` · Ngày nghiên cứu: 2026-11-18 · Phương pháp: đọc mã nguồn, tài liệu chính thức, npm registry, GitHub API. Chưa chạy thử trên file đề thật (repo chưa có file mẫu); những chỗ cần prototype được đánh dấu **[cần thử]**.

---

## 0. Tóm tắt một đoạn

Trong .docx, công thức nằm ở bốn "vỏ" khác nhau: **OLE MathType** (dữ liệu MTEF + ảnh WMF/EMF xem trước), **OMML** (Equation gốc của Word), **ảnh có MathML trong alt text** (add-in MathType cho Microsoft 365), và **văn bản LaTeX** (nếu giáo viên tự chuyển). OMML chuyển sang LaTeX được một cách tất định bằng thư viện JS. MTEF thì **không có thư viện JS trưởng thành nào**: chỉ có gem Ruby (MIT) có thể port, và LibreOffice/pandoc đều không giải được MathType 4+. Vì vậy khuyến nghị cho MVP: **phân giải trong trình duyệt của giáo viên**. OMML sẽ thành LaTeX (KaTeX hiển thị). MathType OLE sẽ thành **ảnh PNG render từ ảnh xem trước WMF/EMF** (độ trung thực "như giáo viên thấy"), kèm hướng dẫn tuỳ chọn cho giáo viên chạy MathType *Convert Equations → LaTeX* nếu muốn sửa được công thức. Hình vẽ là ảnh thì giữ nguyên (EMF/WMF đổi sang PNG). Shape/drawing canvas thì bị **từ chối kèm báo lỗi đúng câu**, và giáo viên được hướng dẫn dán lại hình dưới dạng ảnh.

---

## 1. Các vỏ nội dung trong .docx và cách chuyển

### 1.1 MathType OLE (`w:object` + `oleObjectN.bin`)

**Cấu trúc:**
- Trong `document.xml`, MathType là `w:object` chứa `v:shape/v:imagedata r:id=…` (ảnh xem trước) và một OLE object. Pandoc và mammoth đều nhận diện đúng mẫu `w:object > v:shape > v:imagedata` này ([pandoc Parse.hs, nhánh `w:object`](https://github.com/jgm/pandoc/blob/main/src/Text/Pandoc/Readers/Docx/Parse.hs); [mammoth body-reader.js, `"w:object": readChildElements`, `"v:imagedata": readImageData`](https://github.com/mwilliamson/mammoth.js/blob/master/lib/docx/body-reader.js)).
- `oleObjectN.bin` là Compound File. Stream `"Equation Native"` gồm header OLE 28 byte, tiếp theo là header phiên bản (5 byte với Equation Editor, 12 byte với MathType) rồi đến các record MTEF ([Microsoft, Murray Sargent: *Converting Microsoft Equation Editor Objects to OfficeMath*, 2018](https://learn.microsoft.com/en-us/archive/blogs/murrays/converting-microsoft-equation-editor-objects-to-officemath)). Gem Ruby `mathtype` đọc đúng như vậy: `ole.file.read("Equation Native")[28..-1]` ([jure/mathtype ole.rb](https://github.com/jure/mathtype/blob/master/lib/file_parser/ole.rb)).
- **Ảnh xem trước WMF cũng chứa MTEF**, nhúng trong comment record `AppsMFCC` hoặc `MathTypeUU` ([jure/mathtype wmf.rb](https://github.com/jure/mathtype/blob/master/lib/file_parser/wmf.rb); [wmf-emf-renderer, hàm `extractMathTypeMtef`/`AppsMFCC`](https://www.npmjs.com/package/wmf-emf-renderer)). Nghĩa là chỉ cần có ảnh xem trước là vẫn có thể lấy lại MTEF.
- Đặc tả MTEF v5 (MathType 4.0 trở lên) do Wiris công bố ([MTEF v5](https://docs.wiris.com/en_US/mathtype-mtef-v5-mathtype-40-and-later); bản lưu trữ [rtf2latex2e MTEF5](https://rtf2latex2e.sourceforge.net/MTEF5.html)).

**Các cách chuyển MTEF sang MathML/LaTeX hiện có:**

| Công cụ | Ngôn ngữ | Đầu ra | Trạng thái | Giấy phép | Ghi chú |
|---|---|---|---|---|---|
| `mathtype` gem (jure/sbulka) | Ruby | XML của MTEF | push cuối 2022-10, 21★ | MIT | Đọc OLE, WMF, EPS; có record cho MTEF v3 và v5 ([repo](https://github.com/jure/mathtype)). Mã nhỏ (~vài chục file `records*/`), **port sang TS được** |
| `mathtype_to_mathml` | Ruby + XSLT | MathML | 0.0.7 (2015-09), push cuối 2022-07, 33★ | MIT | XML MTEF chuyển qua XSLT thành MathML; ~165 KB XSLT (char.xsl 72 KB là bảng ký tự), 64 file fixture test ([repo](https://github.com/jure/mathtype_to_mathml); [rubygems](https://rubygems.org/gems/mathtype_to_mathml)) |
| transpect `mathtype-extension` | JRuby + XSLT (XProc) | MathML | push 2026-02 | không ghi rõ | Fork của gem trên, dùng trong docx2tex. Cần Java + Calabash + Saxon ([repo](https://github.com/transpect/mathtype-extension); [docx2tex, BSD-2](https://github.com/transpect/docx2tex)) |
| rtf2latex2e `eqn.c` | C | LaTeX | cũ | GPL | Bộ chuyển MathType sang LaTeX ([nguồn](https://grok.dragonflybsd.org/source/xref/dports/print/rtf2latex2e/rtf2latex2e-2-2-2/src/eqn.c)) |
| Word (Microsoft 365) | đóng | OMML | — | — | Converter trong RichEdit "chuyển được phần lớn object MEE **và MathType** sang OfficeMath", trừ vài cấu trúc như chia dài ([Murray Sargent 2018](https://learn.microsoft.com/en-us/archive/blogs/murrays/converting-microsoft-equation-editor-objects-to-officemath)) |
| MathType SDK *ConvertEquations* | đóng, Windows | mọi translator | — | thương mại | Không dùng được trên serverless ([Wiris SDK](https://docs.wiris.com/en_US/mathtype-sdk-documentation/converting-equations)) |
| **LibreOffice** | C++ | StarMath / OMML khi lưu | — | MPL | **Không giải được MathType 4+**: `MathType::Parse` trả `false` khi `nVersion > 3` ([starmath/source/mathtype.cxx](https://github.com/LibreOffice/core/blob/master/starmath/source/mathtype.cxx)). Trang help cũng nói chỉ hỗ trợ "MathType 3.1 specifications" ([LibreOffice Help](https://help.libreoffice.org/latest/en-US/text/shared/optionen/01130200.html)) |
| **pandoc** (kể cả wasm) | Haskell | — | — | GPL-2+ | Với `w:object`, pandoc **chỉ lấy ảnh xem trước** (`Drawing`) và không giải MTEF ([Parse.hs](https://github.com/jgm/pandoc/blob/main/src/Text/Pandoc/Readers/Docx/Parse.hs)) |
| `dsh-docx2md` | Python plugin | LaTeX | 0.6.6, 2026-11, 0★ | MIT | Cố ý **không** giải MTEF. Tác giả ghi: giải MTEF trực tiếp cho kết quả "thiếu mà không báo lỗi" (ví dụ một ma trận 5 dòng chỉ ra `βP`), nên họ render WMF thành PNG rồi cho mô hình thị giác đọc lại ([npm README](https://www.npmjs.com/package/dsh-docx2md)). Đây là số liệu một chiều từ bộ giải riêng của họ, nhưng là lời cảnh báo đáng giá |
| Trên npm | JS | — | — | — | Tìm "mtef", "mathtype mtef/ole" trên registry npm (2026-11-18) **không ra parser MTEF sang MathML/LaTeX nào**. Chỉ có `wmf-emf-renderer` đọc MTEF *để vẽ ký tự*, không xuất cấu trúc ([npm search](https://registry.npmjs.org/-/v1/search?text=mtef)) |

**Kết luận 1.1:** Hiện chưa có con đường JS "cắm vào là chạy" từ MTEF sang LaTeX. Có hai lựa chọn: (a) port gem Ruby + XSLT (MIT, ước vài nghìn dòng, có sẵn fixture để kiểm), hoặc (b) dùng ảnh xem trước. Phương án (a) có rủi ro "sai mà không báo" như dsh-docx2md mô tả. Microsoft cũng ghi nhận cần nhiều "fixup" (subscript rỗng, pile rỗng, ký tự U+2329/U+232A…) ([Murray 2018](https://learn.microsoft.com/en-us/archive/blogs/murrays/converting-microsoft-equation-editor-objects-to-officemath)).

### 1.2 Equation gốc của Word (OMML, `m:oMath` / `m:oMathPara`)

| Công cụ | Đầu ra | Trạng thái | Giấy phép | Ghi chú |
|---|---|---|---|---|
| `omml2mathml` (scienceai) | MathML DOM | 1.3.0 (2017-07); repo **archived 2018-07** | Apache-2.0 | Port của `omml2mml.xsl` có sửa lỗi, không cần XSLT, chạy trên mọi DOM (xmldom hoặc DOM trình duyệt) ([repo](https://github.com/scienceai/omml2mathml); [npm](https://www.npmjs.com/package/omml2mathml)). Nhỏ, có thể vendor vào và tự bảo trì |
| `mathml-to-latex` (asnunes) | LaTeX | 1.8.0 (**2026-06-10**), TS, 83★ | MIT | Hỗ trợ math, mi, mo, mn, msqrt, mfenced, mfrac, mroot, msup, msub, msubsup, mmultiscripts, mtext, munderover, mtable, mover, munder, menclose…; thẻ lạ thì nối con lại ([Context7 /asnunes/mathml-to-latex](https://github.com/asnunes/mathml-to-latex)) |
| `docx-preview` (docxjs) | MathML trực tiếp trong HTML | 0.4.1 (2026-09-21), 2.1k★ | Apache-2.0 | Map `oMath` sang `<math>`, `mfrac`, `msup`… khi render ([document-parser.ts](https://github.com/VolodymyrBaydalka/docxjs/blob/master/src/document-parser.ts), [html-renderer.ts](https://github.com/VolodymyrBaydalka/docxjs/blob/master/src/html-renderer.ts)). Hợp làm *viewer* hơn là bộ phân giải |
| pandoc / texmath (`pandoc-wasm`) | LaTeX/MathML | pandoc 3.9 (2026-02) là bản đầu có WASM chính thức; npm `pandoc-wasm` 1.1.0 | GPL-2.0+ | Đọc OMML qua `readOMML` ([Parse.hs](https://github.com/jgm/pandoc/blob/main/src/Text/Pandoc/Readers/Docx/Parse.hs); [ANN pandoc 3.9](https://discourse.haskell.org/t/ann-pandoc-3-9-wasm/13659)). Gói nặng **~57 MB** unpacked (npm registry), GPL |
| `omml2mml.xsl` của Microsoft | MathML | đi kèm Office | **không rõ quyền phân phối lại** | Microsoft xác nhận Office có kèm file này ([Murray, *Improved MathML support in Word 2007*](https://learn.microsoft.com/en-nz/archive/blogs/murrays/improved-mathml-support-in-word-2007)), nhưng không có điều khoản cho phép phân phối lại. Ngoài ra **Chrome gỡ XSLT** (`XSLTProcessor`) khỏi Stable từ Chrome 158 (17/11/2026), Firefox và WebKit cũng có kế hoạch tương tự ([Chrome for Developers](https://developer.chrome.com/docs/web-platform/deprecating-xslt)). Không nên dùng XSLT phía trình duyệt |
| **mammoth.js** | — | 1.13.0 (2026-09-26) | BSD-2 | **Bỏ qua OMML**: `m:oMath` không có handler nên rơi vào cảnh báo "An unrecognised element was ignored" ([body-reader.js](https://github.com/mwilliamson/mammoth.js/blob/master/lib/docx/body-reader.js)). Có fork `mammoth-plus` (2022) và `mammoth-math` (2022), đều cũ |

**Kết luận 1.2:** OMML → MathML (`omml2mathml`, vendor vào) → LaTeX (`mathml-to-latex`) là đường tất định, 100% JS, chạy được cả trình duyệt lẫn Node. dsh-docx2md cũng đánh giá đây là vỏ "chuyển tất định, không cần đọc ảnh" ([README](https://www.npmjs.com/package/dsh-docx2md)).

### 1.3 Ảnh có MathML trong alt text (add-in MathType cho Microsoft 365)

Add-in mới của Wiris chèn công thức vào Word **dưới dạng ảnh**, với alt text chứa mô tả rồi đến MathML ([Wiris: Accessibility in MathType for Microsoft 365](https://docs.wiris.com/en_US/using-mathtype-for-microsoft-365/accessibility-in-mathtype-for-microsoft-365-in-word)). Thao tác "Convert from MT7" chuyển một chiều công thức MathType 7 sang định dạng này, và chỉ làm được trên Word desktop ([Wiris](https://docs.wiris.com/en_US/equation-conversion-process-from-mathtype-7-to-mathtype-add-in-for-microsoft-365)). Nhận diện được bằng cách đọc `wp:docPr/@descr` (hoặc title), lấy phần `<math…>` rồi chạy `mathml-to-latex`. **[cần thử]** với một file thật để biết MathML nằm ở `descr` hay `title`.

### 1.4 Ảnh hình học (PNG/JPG/EMF/WMF)

- PNG/JPG/GIF: trình duyệt hiển thị trực tiếp. mammoth chỉ coi png/gif/jpeg/svg/tiff là "hiển thị được", còn lại thì cảnh báo "unlikely to display in web browsers" ([body-reader.js `supportedImageTypes`](https://github.com/mwilliamson/mammoth.js/blob/master/lib/docx/body-reader.js)). Nghĩa là **EMF/WMF phải chuyển đổi**.
- Bộ chuyển EMF/WMF trong JS:
  - `wmf-emf-renderer` 0.2.1 (2026-09-24), MIT, không phụ thuộc gói nào, chạy Node + trình duyệt, xuất SVG hoặc Canvas 2D, hỗ trợ WMF/placeable WMF/EMF/EMF+, **có xử lý riêng ảnh MathType** (đọc MTEF, map font MathType sang Unicode) ([npm README](https://www.npmjs.com/package/wmf-emf-renderer); [repo congduan/WmfEmfViewer](https://github.com/congduan/WmfEmfViewer), 2★, push 2026-10). Còn rất mới, một tác giả. Khi chạy trên Node, ảnh bitmap nhúng bị thay bằng placeholder trừ khi dùng `node-canvas` (README).
  - `rtf.js` (gồm WMFJS/EMFJS, vẽ ra `<svg>`) 3.0.9 (2022-07), MIT, commit cuối 2022-10, 16 issue mở ([repo](https://github.com/tbluemel/rtf.js)). Ổn định nhưng không còn phát triển.
  - LibreOffice/Inkscape: chuyển tốt nhưng là binary lớn (xem mục 2).
- **Lưu ý font:** ảnh WMF của MathType vẽ chữ bằng font Symbol/MT Extra/Euclid. MathType 7 yêu cầu các font này luôn được cài ([Wiris FAQ](https://docs.wiris.com/en_US/mathtype-office-tools/mathtype-for-office-tools-faq)). Vì vậy nên **rasterize thành PNG một lần trên máy giáo viên** (máy đã có font), không gửi SVG chứa `<text>` xuống máy học sinh vì máy học sinh không có font. **[cần thử]** chất lượng render của `wmf-emf-renderer` với ảnh MathType thật.

### 1.5 Shape / drawing canvas (DrawingML `wps`/`wpg`/`wpc`, VML)

- Word 2010+ bọc shape trong `mc:AlternateContent` (Choice = DrawingML, Fallback = VML). mammoth chỉ đọc `mc:Fallback` ([body-reader.js](https://github.com/mwilliamson/mammoth.js/blob/master/lib/docx/body-reader.js)). docx-preview cũng chuyển sang Fallback khi namespace của Choice không được hỗ trợ ([document-parser.ts `checkAlternateContent`](https://github.com/VolodymyrBaydalka/docxjs/blob/master/src/document-parser.ts)).
- docx-preview vẽ VML sang SVG ở mức cơ bản: `rect`, `oval`, `line`, `shape` (path), `textbox`, `imagedata` ([vml.ts](https://github.com/VolodymyrBaydalka/docxjs/blob/master/src/vml/vml.ts)). Không thấy `v:group`/`arc`/`polyline`. Tức là hình hình học vẽ bằng shape (đường thẳng, cung, nhãn điểm trong textbox, nhóm) sẽ **thiếu hoặc lệch**.
- Không tìm thấy thư viện JS nào render đầy đủ DrawingML/drawing canvas thành SVG. pandoc với `w:drawing` chỉ trích ảnh blip, gặp diagram/chart thì trả placeholder ([Parse.hs](https://github.com/jgm/pandoc/blob/main/src/Text/Pandoc/Readers/Docx/Parse.hs)).

**Kết luận 1.5:** Với MVP, nên coi shape/canvas là **"không hỗ trợ"**: phát hiện `wpc:wpc`, `wpg:wgp`, `wps:wsp`, `v:group`, `v:line`… nằm trong một câu thì báo lỗi kèm số câu, và hướng dẫn giáo viên nhóm hình lại, *Copy → Paste Special → Picture (PNG)*. Quy ước này nên đưa vào phiếu 06 (mẫu đề Word).

---

## 2. Chạy chuyển đổi ở đâu (0đ)

| Tiêu chí | Trình duyệt giáo viên | Vercel Function (Node, Hobby) | Supabase Edge Function (Deno, free) |
|---|---|---|---|
| Giới hạn thời gian | không (chạy trong Web Worker) | 300 s mặc định và tối đa ([Vercel limits](https://vercel.com/docs/functions/limitations)) | wall clock 150 s, **CPU 2 s/request** ([Supabase limits](https://supabase.com/docs/guides/functions/limits)) |
| Bộ nhớ | RAM máy | 2 GB / 1 vCPU (Vercel) | **256 MB** (Supabase) |
| Kích thước request | không giới hạn (đọc file local) | **4.5 MB** body, vượt thì 413 (Vercel). Phải upload thẳng lên Storage rồi function đọc lại | — |
| Kích thước bundle | không đáng kể (~1–2 MB JS) | 250 MB uncompressed, "large functions" tới 5 GB đang beta (Vercel) | **20 MB** (CLI) / 5 MB (dashboard); không hỗ trợ thư viện cần đa luồng như sharp (Supabase) |
| Render WMF/EMF ra PNG | Canvas có sẵn, **font MathType có sẵn trên máy giáo viên** | Cần `node-canvas`/`@napi-rs/canvas` (native), Linux không có font Symbol/MT Extra | gần như không khả thi |
| LibreOffice headless | không | về lý thuyết có thể (large functions), nhưng **không giúp gì cho MathType 4+** (mục 1.1) | không |
| Chi phí / quota | 0 | ăn vào quota Hobby (chi tiết ở phiếu 02) | ăn vào quota invocations |

**Khuyến nghị: trình duyệt của giáo viên.** Lý do: (1) không vướng 4.5 MB / 2 s CPU / 256 MB; (2) chỉ máy giáo viên có font MathType để rasterize WMF đúng; (3) màn xem trước và sửa vốn đã chạy phía client; (4) không tốn quota. Server chỉ nhận **JSON đã cấu trúc + các file PNG** (upload lên Supabase Storage). Vercel Function chỉ để kiểm tra lại JSON (schema, kích thước) trước khi ghi DB. Đổi lại: logic phân giải nằm ở client nên server phải validate. Với một giáo viên duy nhất thì rủi ro này thấp.

---

## 3. Phương án dự phòng

### 3.1 Dùng ảnh xem trước của MathType
- Luôn có sẵn (Word cần nó để hiển thị), và pandoc/mammoth cũng chọn đúng hướng này (mục 1.1).
- Ưu điểm: giống hệt những gì giáo viên thấy trong Word, không lo "sai mà không báo".
- Nhược điểm: không sửa được trong trình sửa câu hỏi; trông mờ nếu PNG độ phân giải thấp (nên render 2–3x); căn baseline với chữ xung quanh phải dựa vào kích thước `v:shape@style` và độ nâng/hạ của run **[cần thử]**; không đọc được bằng trình đọc màn hình; trong một phương án trắc nghiệm có thể chứa nhiều ảnh nhỏ.

### 3.2 Bắt giáo viên chuyển trước khi tải lên
- **MathType "Convert Equations" không có đích OMML.** Hướng dẫn tiếng Việt (2023) phải đi đường vòng: *Convert Equations → "LaTeX 2.09 and later"*, rồi trong Word dùng Alt+= và *LaTeX → Convert → All – Professional* để có Equation ([hoahoc.org, 14/03/2023](https://hoahoc.org/chuyen-doi-cong-thuc-qua-lai-giua-mathtype-va-equation-office.html)). Bài viết tự nhận quy trình nhiều bước, có bước thủ công, và "không phải mọi công thức đều chuyển được". Chiều ngược lại (OMML → MathType) có sẵn trong dialog ([cùng nguồn](https://hoahoc.org/chuyen-doi-cong-thuc-qua-lai-giua-mathtype-va-equation-office.html); [Wiris TechNote](https://docs.wiris.com/en_US/math-type-support-notices/error-message-problem-converting-omml-to-mathml)).
- **Phương án tốt hơn: chỉ cần bước đầu.** Chạy *Convert Equations → LaTeX* là MathType tự thay mỗi công thức bằng văn bản `$…$` (dùng translator chính chủ của MathType). Bộ phân giải của mình đọc thẳng chuỗi đó và KaTeX hiển thị. Không cần đến Alt+= trong Word. **[cần thử]**: kiểm tra LaTeX do translator MathType sinh ra có lệnh nào KaTeX không hỗ trợ, và chữ tiếng Việt trong công thức có ổn không.
- **Converter có sẵn trong Word:** Microsoft 365 / Office 2019 (build ≥ 16.0.10730) đổi object Equation Editor sang Office Math khi double-click, kèm lựa chọn chuyển tất cả ([Microsoft Support](https://support.microsoft.com/en-us/office/editing-equations-created-using-the-microsoft-equation-editor-08a44b8c-ae15-41a7-bc15-7239890c0cec)). Blog kỹ thuật của Microsoft nói converter này cũng chuyển được "phần lớn" object MathType ([Murray 2018](https://learn.microsoft.com/en-us/archive/blogs/murrays/converting-microsoft-equation-editor-objects-to-officemath)), nhưng trang Support chỉ nói tới Equation Editor. **[cần thử]** trên máy có cài MathType, vì khi đó double-click nhiều khả năng mở MathType thay vì hiện lời mời chuyển.
- **Mức độ phổ biến ở giáo viên Việt Nam:** không tìm được nguồn sơ cấp đo lường. Các nguồn chỉ cho thấy: Convert Equations yêu cầu MathType đang hoạt động (hết trial thì chỉ xem/in, không sửa được) ([Wiris FAQ](https://docs.wiris.com/en_US/mathtype-office-tools/mathtype-for-office-tools-faq)); và quy trình sang OMML bị coi là rắc rối (hoahoc.org ở trên). **Cần hỏi trực tiếp giáo viên** đang dùng MathType bản nào, Word bản nào, và có chạy được Convert Equations không. Không nên đặt việc chuyển đổi làm điều kiện bắt buộc.

---

## 4. Khuyến nghị

**Pipeline MVP, chạy hoàn toàn trong trình duyệt giáo viên (Web Worker):**

1. Giải nén `.docx` (`fflate` hoặc `jszip`). Tự viết walker cho `document.xml` (DOMParser) thay vì dùng mammoth, vì mammoth bỏ OMML và làm mất cấu trúc cần cho phân giải theo mẫu.
2. Mỗi công thức sinh ra một `MathNode { latex?: string, imageUrl?: string, source: 'omml'|'latex-text'|'mathml-alt'|'mathtype-image' }`:
   - `m:oMath` → `omml2mathml` (vendor vào, Apache-2.0) → `mathml-to-latex` (MIT) → **LaTeX**.
   - Văn bản `$…$` / `\(…\)` (từ MathType Convert Equations hoặc gõ tay) → **LaTeX**.
   - Ảnh có MathML trong alt text → `mathml-to-latex` → **LaTeX**.
   - `w:object` MathType → ảnh WMF/EMF xem trước → `wmf-emf-renderer` (dự phòng: `rtf.js` WMFJS/EMFJS) → canvas → **PNG 2–3x** → Supabase Storage. Lưu thêm `oleObject.bin` gốc để sau này giải lại.
3. Hình: PNG/JPG giữ nguyên; EMF/WMF → PNG như trên; shape/canvas → **lỗi có số câu** kèm hướng dẫn dán lại thành ảnh.
4. Lưu LaTeX làm định dạng chuẩn (sửa được trong trình sửa câu hỏi), hiển thị bằng **KaTeX** (MIT, 0.19.1 tháng 10/2026, `renderToString` có thể chạy ở server, output `htmlAndMathml` ([KaTeX options](https://github.com/katex/katex/blob/main/docs/options.md))). Công thức dạng ảnh có badge "ảnh, chưa sửa được" và nút "nhập LaTeX thay thế".
5. Tài liệu cho giáo viên: *"Muốn công thức sửa được trên web thì trước khi tải lên, chạy MathType → Convert Equations → LaTeX trên một bản sao file."* Đây là tuỳ chọn, không bắt buộc.

**Giai đoạn sau (không chặn MVP):** port `jure/mathtype` + XSLT của `mathtype_to_mathml` (MIT) sang TS để tự đổi MTEF → MathML → LaTeX. Kết quả hiển thị **song song với ảnh** trong màn xem trước, và giáo viên chỉ bấm chấp nhận khi thấy khớp. Dùng 64 fixture có sẵn của repo Ruby làm bộ test.

**Đánh đổi:**

| | Được | Mất |
|---|---|---|
| Ảnh cho MathType (MVP) | trung thực tuyệt đối, làm nhanh, không có lỗi "sai mà không báo" | không sửa được, nặng hơn, căn baseline phải tinh chỉnh, khó tiếp cận với trình đọc màn hình |
| LaTeX cho OMML/LaTeX-text | sửa được, nét, nhẹ, KaTeX nhanh trên mọi trình duyệt (kể cả Zalo/Messenger) | `omml2mathml` đã archived nên phải tự bảo trì; `mathml-to-latex` không phủ hết MathML |
| Client-side | 0đ, không vướng 4.5 MB/2 s CPU, có font MathType | logic ở client nên server phải validate; phụ thuộc máy giáo viên (máy yếu thì chậm) |
| Không hỗ trợ shape/canvas | đơn giản, không render sai | giáo viên phải sửa file nếu vẽ hình bằng shape |
| Bỏ LibreOffice/pandoc | nhẹ, không GPL, không binary 100+ MB | — (cả hai đều không giải được MathType 4+) |

**Việc cần prototype ngay** (trước khi chốt phiếu 06): lấy 2–3 đề thật của giáo viên, đo (a) tỉ lệ MathType / OMML / shape; (b) chất lượng `wmf-emf-renderer` so với `rtf.js` trên ảnh MathType; (c) LaTeX từ MathType Convert Equations có render được bằng KaTeX không; (d) cách căn baseline cho ảnh công thức inline.
