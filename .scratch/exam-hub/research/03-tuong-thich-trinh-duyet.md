# Research 03: Tương thích trình duyệt cho trang làm bài

Phiếu: `.scratch/exam-hub/issues/03-tuong-thich-trinh-duyet.md`
Ngày nghiên cứu: 2026-11-18. Phiên bản tham chiếu: Next.js 16.4.x, KaTeX 0.19.1, MathJax 4.1.3, MDN browser-compat-data 8.1.9 (12/11/2026).

Quy ước: mỗi khẳng định có số nguồn `[n]` (danh sách ở cuối). Chỗ nào là **suy luận** hoặc **cần thử trên máy thật** thì ghi rõ.

---

## Tóm tắt nhanh

- **Công thức:** dùng **KaTeX, render sẵn ở server lúc xuất bản** (`renderToString`), trình duyệt chỉ cần CSS + font KaTeX, không cần JS. Không dựa vào MathML gốc làm đường hiển thị chính.
- **Tự lưu / đếm rời tab:** server là nguồn sự thật; `localStorage` chỉ là bộ đệm. Lưu khi `visibilitychange → hidden` + `pagehide`, gửi bằng `fetch(..., {keepalive: true})`. Không dùng `beforeunload`/`unload`. Trong WebView Android, `visibilitychange` có thể không chạy, cần thêm tín hiệu `blur`/heartbeat.
- **Browserslist:** mặc định Next.js 16 là Chrome/Edge/Firefox 111, Safari 16.4. Khoảng 4,8% lượt dùng iOS ở VN đang ở iOS 15.8 (dưới 16.4). Đề xuất hạ target xuống `safari >= 15.4`, `ios_saf >= 15.4` và thử trên máy thật. Nếu làm vậy thì không dùng Tailwind v4 (Tailwind v4 cần Safari 16.4).
- **Zalo:** không có tài liệu chính thức về trình duyệt trong app. Trên iOS bắt buộc chạy WebKit (cùng engine với Safari của máy); trên Android là WebView do app cấu hình. Tải file, `window.open`, deep link và lưu trữ đều phụ thuộc cách app cài đặt WebView. Phải tự kiểm thử.

---

## 1. Hiển thị công thức toán

### 1.1 MathML gốc (MathML Core)

- Chrome/Edge/Chrome Android/Android WebView hỗ trợ `<math>` từ **bản 109**. Chrome 24 từng có nhưng gỡ ở bản 25 vì "code was not yet production ready" [1][2].
- Safari có `<math>` từ 5.1 (iOS 5), Firefox từ bản 4 [1]. Nhưng đó là cài đặt MathML cũ, không phải MathML Core. MDN ghi lịch sử chuẩn hoá MathML "erratic": phần trình bày (layout) "led to incomplete and inconsistent browser implementations" [3].
- Trong intent-to-ship của Chromium, tác giả nói thẳng: "Not all operating systems come with a pre-installed OpenType MATH font", và "yes there is likely to be interop gaps and yes some work will be needed on the WebKit/Gecko side" [4]. Vậy cùng một đoạn MathML có thể hiển thị khác nhau giữa Chrome Android, Safari iOS và Firefox.
- `font-family: math` (cách chọn font toán chuẩn) chỉ có ở Chrome 109, Firefox 149 và **Safari/iOS 26.2** [1]. Trên các iOS cũ hơn vẫn còn phổ biến ở VN (mục 3.3), không có cách chuẩn để ép font toán cho MathML gốc.
- MDN xếp MathML vào mức "Baseline widely available since January 2023" [3]. Nhãn này chỉ nói thẻ `<math>` có mặt ở mọi trình duyệt, không nói chất lượng hiển thị giống nhau.

**Kết luận:** MathML gốc **không an toàn** làm đường hiển thị chính cho đối tượng này. Lý do: iOS cũ không có MathML Core, Android có thể thiếu font toán, và cài đặt giữa các engine lệch nhau. Chỉ nên dùng MathML làm lớp phụ cho trình đọc màn hình (KaTeX tự làm việc này ở chế độ `htmlAndMathml`).

### 1.2 KaTeX (đầu ra HTML + CSS)

- KaTeX nói hỗ trợ "all major browsers, including Chrome, Safari, Firefox, Opera, and Edge" [5]. Không có danh sách phiên bản tối thiểu.
- Tuỳ chọn `output`: `html`, `mathml`, hoặc `htmlAndMathml` (mặc định): "Outputs HTML for visual rendering and includes MathML for accessibility" [6].
- **Render ở server:** "KaTeX produces the same output regardless of browser or environment, so you can pre-render expressions using Node.js" [7]. API: `katex.renderToString` dùng để "generate HTML on the server" [8].
- Kích thước bản 0.19.1 (đo trực tiếp từ jsDelivr, gzip -9) [9]:
  - `katex.min.js`: 273 KB thô, **~76 KB gzip**. Chỉ cần nếu render ở client.
  - `katex.min.css`: 24,8 KB thô, **~3,5 KB gzip**.
  - Font: 20 file woff2, tổng ~254 KB. Trình duyệt chỉ tải font nào thực sự được dùng. Đề thường dùng chủ yếu `KaTeX_Main-Regular` (26 KB) và `KaTeX_Math-Italic` (16 KB).
- Font KaTeX mặc định dùng `font-display: block` (chữ vô hình cho tới khi font tải xong). Có bản `katex-swap.css` nếu muốn tránh điều này. Thư mục `fonts/` phải nằm cạnh file CSS vì CSS gọi font bằng đường dẫn tương đối [5].
- Tuỳ chọn an toàn: `trust` mặc định `false`, chặn các lệnh có thể gây hại như `\includegraphics`. `maxExpand` mặc định 1000 để chặn vòng lặp macro. `throwOnError` mặc định `true` [6].
- Bản phát hành gần nhất: v0.19.1 (23/10/2026). Thay đổi phá vỡ ở v0.19.0 chỉ liên quan cảnh báo `strict`, không đổi đầu ra hay font [10].
- Về hiệu năng, KaTeX nói nó "renders its math synchronously and doesn't need to reflow the page" [7]. Đây là tuyên bố của nhà phát triển. Không tìm thấy benchmark độc lập trên điện thoại yếu.

### 1.3 MathJax 3/4

- Bản mới nhất là 4.1.3. MathJax 4 "no longer supports any version of Internet Explorer". Đầu ra CHTML/SVG hỗ trợ "all modern browsers (Chrome, Safari, Firefox, Edge), and most mobile browsers", không nêu phiên bản cụ thể [11].
- Kích thước đo được (gzip -9) [9]:
  - `mathjax@4.1.3/tex-chtml.js`: ~997 KB thô, **~281 KB gzip**, chưa tính font tải thêm.
  - `tex-svg.js`: ~1,85 MB thô, **~615 KB gzip**.
  - `mathjax@3.2.2/es5/tex-chtml.js`: ~1,16 MB thô, ~262 KB gzip.
- MathJax nhắc: thiếu hoặc sai thẻ viewport trên di động có thể làm chữ toán rất nhỏ [11].

**So sánh:** gói client của MathJax lớn gấp khoảng **3,7 lần** KaTeX (281 so với 76 KB gzip). Nếu KaTeX render ở server thì client tải **0 KB JS** cho công thức. MathJax mạnh hơn về độ phủ cú pháp và ngắt dòng, nhưng không đáng đổi lấy kích thước đó cho đề Toán phổ thông.

### 1.4 Có nên render sẵn ở server lúc xuất bản không?

**Nên.** Lý do:
1. Đầu ra KaTeX không phụ thuộc trình duyệt [7], nên render một lần lúc giáo viên bấm xuất bản (hoặc khi lưu câu hỏi) rồi lưu HTML vào DB là hợp lệ.
2. Học sinh trên máy yếu hoặc WebView không phải tải và chạy ~76 KB JS gzip cho mỗi lần mở đề. Trang chỉ còn HTML tĩnh + 3,5 KB CSS + vài font.
3. Lỗi cú pháp LaTeX lộ ra ở màn xem trước của giáo viên (`throwOnError: true` lúc xuất bản) thay vì trên máy học sinh.

Lưu ý khi làm (suy luận từ [5][6]):
- **Ghim phiên bản KaTeX** và lưu kèm phiên bản dùng để render. CSS ở client phải cùng phiên bản với HTML đã render. Khi nâng KaTeX thì render lại toàn bộ câu hỏi.
- Giữ `trust: false`, đặt `maxSize`/`maxExpand` hữu hạn. Coi HTML đã render là nội dung tin cậy chỉ khi nó do server tự sinh từ LaTeX, không nhận HTML từ client.
- Tự host CSS và font (cùng origin trên Vercel), không dùng CDN ngoài. Có thể `preload` hai font chính. Cân nhắc `katex-swap.css` để chữ không bị vô hình khi mạng chậm.
- Trình sửa công thức phía giáo viên vẫn cần KaTeX ở client để xem trước trực tiếp. Chỉ trang làm bài của học sinh mới không cần JS KaTeX.
- Phụ thuộc phiếu 01: công thức MathType trong .docx phải chuyển được sang LaTeX (hoặc MathML rồi sang LaTeX) thì mới dùng được KaTeX.

---

## 2. Lưu trữ cục bộ và sự kiện vòng đời trang

### 2.1 localStorage / IndexedDB

- Hỗ trợ API thì không phải vấn đề: `localStorage` có từ Safari iOS 3.2 và Android WebView 4.4; IndexedDB có từ Safari/iOS 8 [1].
- **Safari xoá dữ liệu:** ITP xoá "all of a website's script-writable storage after seven days of Safari use without user interaction on the site". Gồm IndexedDB, LocalStorage, SessionStorage, Service Worker cache [12].
- **WKWebView trong app (Zalo, Messenger trên iOS):** từ iOS 14, "Intelligent Tracking Prevention (ITP), is enabled by default in all `WKWebView` applications" [13]. **Suy luận:** quy tắc 7 ngày có thể áp dụng cả trong WebView của Zalo/Messenger. WebKit không nói rõ điểm này.
- **Hạn mức và eviction (Safari 17+):** app trình duyệt được tới 60% dung lượng đĩa cho mỗi origin, app khác (gồm app nhúng WebView) được 15%. Dữ liệu bị xoá khi vượt quota, khi máy thiếu bộ nhớ, hoặc sau một thời gian không tương tác, theo thứ tự ít dùng gần đây nhất. `navigator.storage.persist()` không được đảm bảo; WebKit cấp theo heuristic, ví dụ site được mở như web app trên màn hình chính [14]. `persist()` có từ Safari 15.2 [1].
- **Android WebView:** `WebSettings.setDomStorageEnabled` mặc định **`false`** [15]. Nếu app nhúng không bật thì `localStorage` không dùng được. Zalo/Messenger chắc đã bật, nhưng **cần kiểm tra trên máy thật**, và code phải bọc try/catch.
- **WebView bị hệ thống giết:** Android có thể giết tiến trình renderer của WebView để lấy lại bộ nhớ. Khi đó app phải tạo WebView mới [16]. Với người dùng, trang làm bài bị tải lại từ đầu.
- **Kho cookie và storage của mỗi app tách biệt:** cookie trong WebView của app không chung với Chrome [17] (nguồn thứ cấp). Custom Tabs thì chung cookie với trình duyệt chính [18]. **Hệ quả:** học sinh mở link trong Zalo rồi chuyển sang Chrome sẽ là "máy mới" với app. Phải khôi phục Bài làm từ server.

**Kết luận:** dữ liệu cục bộ có thể mất bất cứ lúc nào: WebView bị giết, ITP, eviction, xoá cache của app, đổi trình duyệt. Server phải là nguồn sự thật. `localStorage` chỉ giữ bản nháp của lượt đang làm, để không mất câu trả lời khi mạng chập chờn. Dữ liệu một Bài làm (vài chục câu trả lời) rất nhỏ, nên `localStorage` đồng bộ đơn giản hơn IndexedDB và đủ dùng.

### 2.2 visibilitychange / pagehide / beforeunload

| Sự kiện | Chrome / Chrome Android / WebView | Safari macOS | Safari iOS | Firefox |
|---|---|---|---|---|
| `visibilitychange` (đầy đủ) | 62 | 14.1 | 14.5 | 56 |
| `pagehide` | 3 / 18 / 4.4 | 5 | 4.2 | 6 |
| `beforeunload` | 1 / 18 / 4.4 | 3 | **không hỗ trợ** | 1 |
| `navigator.sendBeacon` | 39 / 42 / 40 | 11.1 | 11.3 | 31 |
| `fetch` `keepalive` | 66 | 13 | 13 | **133** |

Nguồn: MDN browser-compat-data [1].

- `visibilitychange` chạy với trạng thái `hidden` khi người dùng "navigates to a new page, switches tabs, closes the tab, minimizes or closes the browser, or, on mobile, switches from the browser to a different app". Chuyển sang `hidden` là "the last event that's reliably observable by the page" [19].
- Chrome khuyên: chuyển sang terminated "cannot be reliably detected in many cases (especially on mobile)". Ai dựa vào `beforeunload`, `pagehide`, `unload` "are likely losing data". Nên coi `hidden` là kết thúc phiên và lưu trạng thái lúc đó [20].
- Safari trước 14.1 / iOS 14.5 không bắn `visibilitychange` khi rời trang. BCD khuyên nghe thêm `pagehide` [1]. Lỗi WebKit 151234 được sửa năm 2020 (r267589). Bản sửa cũng làm Safari bắn `pagehide` trước `visibilitychange` như Chrome và Firefox [21].
- **WebView Android:** một code review Chromium năm 2016 ghi WebView "will ignore view visibility for blink page visibility API". App nhúng phải gọi `WebView#onPause/onResume` thì trạng thái visibility mới đổi [22]. Một thread android-webview-dev lại báo WebView 54 trả `hidden` đúng khi app vào nền [23]. **Hệ quả:** trong Zalo/Messenger Android, việc đếm rời tab bằng `visibilitychange` phụ thuộc cách app cài đặt. **Bắt buộc thử trên máy thật.**
- **Bộ đếm giờ khi trang ẩn:** Chrome giới hạn timer của trang ẩn còn 1 lần/giây. Sau 5 phút ẩn, chuỗi timer bị giới hạn còn 1 lần/phút [24]. Vậy đồng hồ đếm ngược phải tính `deadline_server - now_đã_hiệu_chỉnh` ở mỗi tick, không trừ dần một biến đếm.
- **Gửi lúc rời trang:** `keepalive` giới hạn thân request **64 KiB**, gửi được method khác POST và đọc được phản hồi. `sendBeacon` chỉ POST, và từ Chrome 59 không gửi được Blob có type không nằm trong danh sách CORS-safelisted [25][1]. Firefox chỉ có `keepalive` từ 133 [1]. Firefox bản cũ hơn cần fallback `sendBeacon`.

**Thiết kế đề xuất cho đếm rời tab** (suy luận từ các nguồn trên):
- Tín hiệu chính: `visibilitychange` sang `hidden`. Tín hiệu phụ: `pagehide`, và `window.blur` (đánh dấu riêng, vì `blur` còn bắn khi mở bàn phím hệ thống, hộp thoại...). Gộp các sự kiện gần nhau (debounce khoảng 1–2 giây) thành một lần rời.
- Thêm tín hiệu ở server: client gửi heartbeat định kỳ khi trang hiển thị. Khoảng trống heartbeat lớn bất thường cũng được ghi lại như một lần "mất tín hiệu", không nhất thiết là gian lận.
- Ghi số lần rời theo kiểu chỉ cộng thêm ở server (mỗi lần là một sự kiện có thời điểm), không tin một con số tổng do client gửi lên.
- Trên giao diện giáo viên, gọi đây là "số lần rời trang ghi nhận được" và chấp nhận báo sai trong cả hai chiều (cuộc gọi đến, thông báo hệ thống, WebView không báo). Điều này khớp với ràng buộc "ghi số lần, không khoá màn hình" trong map.

---

## 3. Mốc trình duyệt tối thiểu (browserslist)

### 3.1 Mặc định của Next.js 16

- Next.js 16 hỗ trợ "modern browsers with zero configuration": **Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+**. Browserslist mặc định là `["chrome 111", "edge 111", "firefox 111", "safari 16.4"]` [26][27] (Context7 `/vercel/next.js/v16.4.5` cho kết quả giống hệt). Đây là thay đổi phá vỡ của Next 16. Next 15 ghi hỗ trợ từ Safari 12 [27][28].
- Trong mã nguồn `next@16.4.6`, hằng `MODERN_BROWSERSLIST_TARGET` chứa đúng danh sách đó. `getSupportedBrowsers()` dùng browserslist của dự án nếu có, không có thì lấy danh sách mặc định [29].
- Next tự chèn polyfill cho `fetch()`, `URL`, `Object.assign()`, chỉ với trình duyệt cần. Polyfill khác phải tự thêm qua `instrumentation-client.ts` (App Router) [26].
- Turbopack (bundler mặc định của Next 16) luôn dùng SWC để hạ cú pháp xuống bản ECMAScript cũ hơn [30]. CSS đi qua Lightning CSS, tự hạ theo browserslist [30]. Trong bản webpack, SWC cũng nhận `env.targets` theo browserslist, kể cả `node_modules` ở lớp browser (`dist/build/swc/options.js`) [29]. **Suy luận:** đặt browserslist thấp hơn thì cú pháp được hạ, nhưng **API mới thì không** (ví dụ `structuredClone`, `Array.prototype.at`). Phải tự polyfill hoặc tránh dùng.
- Runtime client sẵn có của Next dùng private class fields (`#field`, ví dụ trong `dist/client/components/promise-queue.js`) [29]. Safari 15 hỗ trợ cú pháp này, nên không chặn mốc Safari 15.4. **Suy luận, cần build thử để xác nhận.**

### 3.2 Thư viện CSS

- **Tailwind CSS v4** phụ thuộc Chrome 111, **Safari 16.4**, Firefox 128 cho phần lõi [31]. Nó dùng `@property` (Safari 16.4) và `color-mix()` (Safari 16.2) [1]. Nếu muốn hỗ trợ iOS 15 thì **không dùng Tailwind v4**: dùng Tailwind v3.x hoặc CSS Modules thuần.

### 3.3 Dữ liệu Việt Nam (StatCounter, tháng 10/2026)

- Hệ điều hành di động ở VN: Android 61,71%, iOS 38,27% [32].
- Trình duyệt di động ở VN: Chrome 62,76%, Safari 27,25%, Cốc Cốc 3,98%, UC 2,87%, Samsung Internet 2,4% [33]. StatCounter không tách riêng WebView Zalo/Messenger.
- Phiên bản iOS ở VN, top 6: 26.6 (27,56%), 18.7 (12,78%), 26.5 (7,73%), **16.7 (6,2%)**, 27.0 (5,7%), **15.8 (4,76%)**. Khoảng 35% còn lại không được liệt kê [34]. iOS 15.8 là bản cuối cho các iPhone không lên được iOS 16 (iPhone 6s/7/SE đời 1, theo nguồn thứ cấp [35]).
  - **Ước tính:** ít nhất 4,76% lượt dùng iOS, tức khoảng **1,8% tổng lượt di động**, đang dưới mốc Safari 16.4 mặc định. Phần 35% không liệt kê có thể còn iOS 15.x, 16.0–16.3 và các bản cũ hơn. Đây là số lượt xem trang, không phải số người dùng.
- Phiên bản Android ở VN: 16 (30,8%), 15 (16,23%), 13 (13,89%), 14 (13,42%), 12 (8,67%), 11 (7,97%) [36]. Với Android, phiên bản hệ điều hành ít quan trọng hơn vì WebView/Chrome cập nhật qua Play. Từ Android 7, người dùng còn chọn được gói WebView [16].
- **iOS: engine là phiên bản iOS.** App Store Review Guideline 2.5.6 yêu cầu "Apps that browse the web must use the appropriate WebKit framework and WebKit JavaScript". Ngoại lệ chỉ áp dụng ở EU và Nhật [37]. Ở VN, Zalo, Messenger, Chrome iOS và Cốc Cốc iOS đều chạy WebKit cùng phiên bản với Safari của máy. Một em dùng iPhone 7 (iOS 15.8) gặp cùng giới hạn dù mở bằng app nào.

### 3.4 Đề xuất browserslist

```json
"browserslist": [
  "chrome >= 109", "and_chr >= 109", "edge >= 109",
  "firefox >= 115",
  "safari >= 15.4", "ios_saf >= 15.4",
  "samsung >= 21"
]
```

Lý do chọn mốc:
- **Safari/iOS 15.4** gom được nhiều tính năng nền: `structuredClone`, `Array.at`, `:has()`, `@layer`, `BroadcastChannel` đều có từ Safari 15.4 [1]. Mốc này phủ cả iOS 15.8 (máy kẹt ở iOS 15).
- **Chrome 109** trùng mốc MathML Core [1], nên lớp MathML phụ của KaTeX có ý nghĩa với trình đọc màn hình. Đây là mốc mềm, vì WebView Android tự cập nhật.
- **Firefox 115** là bản ESR cũ (suy luận, không phải yêu cầu cứng). Lưu ý `keepalive` chỉ có từ Firefox 133, nên cần fallback `sendBeacon`.
- **Cái giá:** không dùng Tailwind v4. Phải kiểm tra build trên máy iOS 15 thật hoặc BrowserStack. Next không cam kết hỗ trợ dưới mốc mặc định, nên đây là rủi ro ta tự chịu.
- Nếu không muốn gánh rủi ro đó: giữ mặc định (Safari 16.4) và hiện trang thông báo "Thiết bị quá cũ" cho iOS < 16.4. Khoảng 1,8% lượt di động sẽ không làm được bài.

---

## 4. Trình duyệt trong Zalo (và Messenger)

**Lưu ý về nguồn:** không tìm thấy tài liệu chính thức nào của Zalo về trình duyệt trong app (User-Agent, cookie, tải file). Phần dưới ghép từ tài liệu nền tảng (Apple, Android, Chromium) và một ít nguồn cộng đồng. Mọi điểm đều cần **kiểm thử trên máy thật**.

### 4.1 Engine và nhận diện

- **iOS:** bắt buộc dùng WebKit [37]. Từ iOS 14, ITP bật mặc định trong mọi WKWebView [13].
- **Android:** WebView là Chromium, cập nhật độc lập. Các thiết lập do app quyết định: DOM storage mặc định tắt [15], `window.open()` không có cử chỉ người dùng mặc định thất bại [15], tải file chỉ chạy khi app cài `DownloadListener` để "Notify the host application that a file should be downloaded" [38].
- Facebook (app chính) trên Android đã chuyển sang WebView Chromium riêng, nạp từ bộ nhớ của app thay vì System WebView, từ 2022 [39]. Với Messenger thì không xác nhận được.
- In-app browser của Facebook/Instagram trên iOS từng chèn JS (`pcm.js`) vào mọi trang bên thứ ba (Felix Krause, 08/2022; Meta xác nhận và giải thích là để tuân thủ ATT) [40]. **Hệ quả:** không giả định môi trường trang "sạch". Không để đáp án hay dữ liệu nhạy cảm trên client (khớp ghi chú "đáp án không gửi xuống trình duyệt" trong map).
- **Nhận diện bằng User-Agent:** `ua-parser-js` 2.0.10 có quy tắc `/(zalo(?:app)?)[\/\sa-z]*([\w\.-]+)/i` gắn type `inapp` cho Zalo, và `fban/fbios`, `fb_iab/fb4a`, `fbav` cho app Facebook/Messenger [41]. WebView Android thường có dấu `wv` trong UA [17] (thứ cấp). Chỉ nên dùng UA để **hiện gợi ý**, không dùng để chặn.

### 4.2 Mở link và "mở bằng trình duyệt ngoài"

- Zalo mặc định mở link trong trình duyệt tích hợp. Người dùng có thể bật "Mở bằng trình duyệt web" trong Cài đặt → Quyền riêng tư → Tiện ích (hướng dẫn thứ cấp [42]). Zalo PC/Web mở bằng trình duyệt mặc định [43].
- Trang web **không có cách chuẩn** để tự thoát khỏi WebView iOS. Trên Android, URL `intent:` chỉ được Chrome xử lý khi có cử chỉ người dùng [44]. Trong WebView, việc này tuỳ app có chặn `shouldOverrideUrlLoading` hay không (suy luận từ [15][38]). Cộng đồng dev Zalo có báo cáo "Không mở được app deep link trên zalo" [45] (không đọc được nội dung chi tiết).
- **Đề xuất:** khi nhận ra UA Zalo/Messenger, hiện một dải thông báo nhẹ: "Nếu gặp lỗi, bấm ⋯ → Mở bằng trình duyệt". Vẫn **cho làm bài bình thường trong WebView**, vì đó là kênh chính.

### 4.3 Cookie và lưu trữ

- Cookie và storage trong WebView của app tách khỏi Safari/Chrome [17][18]. Học sinh mở cùng link ở Zalo rồi ở Chrome thì sẽ thành hai phiên khác nhau.
- Rủi ro mất dữ liệu: ITP 7 ngày (iOS, suy luận [12][13]), quota 15% cho app không phải trình duyệt (iOS 17+ [14]), WebView bị giết khi thiếu RAM (Android [16]), người dùng xoá cache Zalo (chưa xác minh).
- **Hệ quả cho phiếu 04 (danh tính học sinh):** token phiên lưu ở cookie/`localStorage` có thể mất giữa chừng. Cần đường khôi phục từ server (ví dụ nhập lại tên + mã Bài giao để tiếp tục lượt đang làm), không coi mất token là bắt đầu lượt mới.

### 4.4 Tải file

- Trên Android, tải file trong WebView chỉ chạy khi app cài `DownloadListener` [38]. Trên iOS, WKWebView cũng cần app tự xử lý (chưa trích được nguồn Apple, cần thử). Người dùng thường gặp lỗi không tải hoặc không mở được file trong Zalo (nguồn thứ cấp, nguyên nhân do quyền bộ nhớ hoặc thiếu app mở file [46]). Zalo Mini App còn cấm tải file trực tiếp, bắt dùng API `downloadFile` [47]. Đó là Mini App, không phải WebView thường, nhưng cho thấy hướng của nền tảng.
- **Đề xuất:** học sinh không cần tải file nào. Xuất Excel bảng điểm là chức năng của giáo viên. Nếu phát hiện WebView thì hướng dẫn mở bằng trình duyệt ngoài trước khi tải.

---

## 5. Đề xuất cụ thể

1. **Công thức:** KaTeX, `output: "htmlAndMathml"`, **render ở server lúc lưu hoặc xuất bản câu hỏi**. Lưu HTML kèm phiên bản KaTeX. Ghim KaTeX trong `package.json`. Tự host `katex.min.css` + font. Preload `KaTeX_Main-Regular` và `KaTeX_Math-Italic`. Trang làm bài không tải JS KaTeX. Không dùng MathJax. Không dùng MathML gốc làm đường hiển thị chính.
2. **Ảnh hình học:** nhúng `<img>` có sẵn `width`/`height` để tránh nhảy layout. Định dạng chi tiết để phiếu 01 chốt.
3. **Đồng hồ:** server trả `deadline` (thời điểm tuyệt đối) và giờ server. Client tính độ lệch, rồi mỗi tick tính `deadline - (Date.now() + offset)`. Tính lại khi `visibilitychange → visible`. Server từ chối Bài làm nộp sau deadline cộng một khoảng ân hạn nhỏ.
4. **Tự lưu:**
   - Mỗi thay đổi câu trả lời thì ghi ngay vào `localStorage` (bọc try/catch), rồi gửi lên server có debounce khoảng 1–3 giây, idempotent theo `(bài làm, câu, phiên bản)`.
   - Khi `visibilitychange → hidden` và khi `pagehide`: gửi nốt phần chưa đồng bộ bằng `fetch(url, {method: "POST", keepalive: true, body})` (dưới 64 KiB). Fallback `navigator.sendBeacon` với body `text/plain` hoặc `application/x-www-form-urlencoded`.
   - Không dùng `beforeunload`/`unload`.
   - Khi mở lại trang thì luôn lấy trạng thái từ server, gộp với bản nháp cục bộ mới hơn nếu có.
5. **Đếm rời tab:** `visibilitychange(hidden)` là chính, `pagehide`/`blur` là phụ, debounce, và ghi từng sự kiện có thời điểm ở server. Thêm heartbeat để phát hiện khoảng mất tín hiệu. Hiển thị cho giáo viên như số liệu tham khảo.
6. **Browserslist:** `safari >= 15.4, ios_saf >= 15.4, chrome >= 109, and_chr >= 109, edge >= 109, firefox >= 115, samsung >= 21`. **Không dùng Tailwind v4** (dùng v3.x hoặc CSS Modules). Tránh hoặc polyfill các API mới hơn Safari 15.4. Phương án dự phòng: giữ mặc định Next 16 và hiện trang "thiết bị chưa hỗ trợ" cho iOS < 16.4.
7. **WebView Zalo/Messenger:** cho phép làm bài trong WebView. Nhận diện bằng UA (`ua-parser-js` hoặc regex `zalo|fban|fbav|fb_iab|; wv\)`) chỉ để hiện gợi ý "mở bằng trình duyệt". Khôi phục phiên từ server khi mất cookie. Không cần tải file phía học sinh.
8. **Ma trận kiểm thử bắt buộc trước khi phát hành** (vì nhiều điểm trên chưa có tài liệu chính thức):
   - iPhone iOS 15.8 (Safari + Zalo + Messenger), iPhone iOS 16.7, iOS mới nhất.
   - Android máy yếu (RAM 2–3 GB) với Chrome, Zalo, Messenger, Cốc Cốc.
   - Desktop Chrome, Edge, Firefox, Safari.
   - Kịch bản cần thử:
     - (a) chuyển app rồi quay lại: số lần rời có tăng không;
     - (b) tắt app giữa chừng rồi mở lại link: câu trả lời còn không;
     - (c) bật chế độ máy bay khi đang làm;
     - (d) để máy khoá màn hình 10 phút: đồng hồ có đúng không;
     - (e) mở link Zalo rồi chuyển sang Chrome: có tiếp tục được lượt cũ không;
     - (f) công thức hiển thị đúng và đủ font.

---

## Nguồn

1. MDN browser-compat-data 8.1.9 (data.json, 2026-11-12), các mục `mathml.elements.math`, `css.properties.font-family.math`, `api.Document.visibilitychange_event`, `api.Window.pagehide_event`, `api.Window.beforeunload_event`, `api.Navigator.sendBeacon`, `api.Request.keepalive`, `api.Window.localStorage`, `api.indexedDB`, `api.StorageManager.persist`, `api.structuredClone`, `javascript.builtins.Array.at`, `css.selectors.has`, `css.at-rules.layer`, `api.BroadcastChannel`, `css.at-rules.property`, `css.types.color.color-mix`. https://cdn.jsdelivr.net/npm/@mdn/browser-compat-data/data.json
2. Can I use: MathML. https://caniuse.com/mathml
3. MDN: MathML. https://developer.mozilla.org/en-US/docs/Web/MathML
4. blink-dev: Intent to Ship: MathML. https://groups.google.com/a/chromium.org/g/blink-dev/c/n4zf_3FWmAA/m/oait3tsMAQAJ
5. KaTeX docs: Browser. https://katex.org/docs/browser
6. KaTeX docs: Options. https://katex.org/docs/options
7. KaTeX trang chủ. https://katex.org/
8. KaTeX docs: API. https://katex.org/docs/api
9. Đo trực tiếp từ jsDelivr (curl + `gzip -9`, 2026-11-18): `katex@0.19.1/dist/*`, `mathjax@4.1.3/tex-chtml.js`, `tex-svg.js`, `mathjax@3.2.2/es5/tex-chtml.js`; danh sách font qua `data.jsdelivr.com/v1/packages/npm/katex@0.19.1`. Phiên bản mới nhất theo `npm view`.
10. KaTeX releases. https://github.com/KaTeX/KaTeX/releases
11. MathJax docs: Browser Support. https://docs.mathjax.org/en/latest/output/browser.html
12. WebKit blog: Full Third-Party Cookie Blocking and More (7-Day Cap on All Script-Writeable Storage). https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
13. WebKit blog: App-Bound Domains. https://webkit.org/blog/10882/app-bound-domains/
14. WebKit blog: Updates to Storage Policy. https://webkit.org/blog/14403/updates-to-storage-policy/
15. Android Developers: WebSettings (`setDomStorageEnabled`, `setJavaScriptCanOpenWindowsAutomatically`). https://developer.android.com/reference/android/webkit/WebSettings
16. Android Developers: Manage WebView objects (Version API, Termination Handling API). https://developer.android.com/develop/ui/views/layout/webapps/managing-webview
17. (Thứ cấp) Link.boo: In-app browser cookies explained; 51Degrees: WebView detection. https://link.boo/guides/in-app-browser-cookies-explained · https://51degrees.com/blog/webview-detection
18. (Thứ cấp) 9to5Google: Facebook Android WebView (Custom Tabs dùng chung cookie với trình duyệt chính). https://9to5google.com/2022/09/30/facebook-android-webview/
19. MDN: Document: visibilitychange event. https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
20. Chrome for Developers: Page Lifecycle API. https://developer.chrome.com/docs/web-platform/page-lifecycle-api
21. WebKit bug 151234 và commit r267589. https://bugs.webkit.org/show_bug.cgi?id=151234 · https://webkit.googlesource.com/WebKit/+/19a0fdc44a53b93965d720af741c68e77bc91d77%5E%21
22. Chromium code review 1475843004 (WebView bỏ qua view visibility với Page Visibility API). https://codereview.chromium.org/1475843004
23. android-webview-dev: Page Visibility API. https://groups.google.com/a/chromium.org/d/msg/android-webview-dev/LpBaOxxcAhY/XaOL6o3wBAAJ
24. Chrome for Developers: Heavy throttling of chained JS timers beginning in Chrome 88. https://developer.chrome.com/blog/timer-throttling-in-chrome-88
25. MDN: RequestInit (`keepalive`). https://developer.mozilla.org/en-US/docs/Web/API/RequestInit
26. Next.js docs: Supported Browsers. https://nextjs.org/docs/architecture/supported-browsers
27. Next.js blog: Next.js 16 (Version Requirements); Context7 `/vercel/next.js/v16.4.5` (upgrading/version-16.mdx, supported-browsers.mdx). https://nextjs.org/blog/next-16
28. Next.js 15 docs: Supported Browsers. https://nextjs.org/docs/15/architecture/supported-browsers
29. Mã nguồn `next@16.4.6` (npm tarball): `dist/shared/lib/modern-browserslist-target.js`, `dist/build/get-supported-browsers.js`, `dist/build/swc/options.js`, `dist/client/components/promise-queue.js`.
30. Next.js docs (Context7 `/vercel/next.js/v16.4.5`): Turbopack, Language features; `useLightningcss`/`lightningCssFeatures`. https://nextjs.org/docs/app/api-reference/turbopack
31. Tailwind CSS: Compatibility. https://tailwindcss.com/docs/compatibility
32. StatCounter: Mobile OS Market Share Viet Nam (10/2026). https://gs.statcounter.com/os-market-share/mobile/viet-nam
33. StatCounter: Mobile Browser Market Share Viet Nam (10/2026). https://gs.statcounter.com/browser-market-share/mobile/viet-nam
34. StatCounter: Mobile & Tablet iOS Version Market Share Viet Nam (10/2026). https://gs.statcounter.com/ios-version-market-share/mobile-tablet/viet-nam
35. (Thứ cấp) TechSpot: iOS 16 supports last 5 years devices. https://www.techspot.com/news/94854-apple-ios-16-supports-last-5-years-devices.html
36. StatCounter: Mobile & Tablet Android Version Market Share Viet Nam (10/2026). https://gs.statcounter.com/android-version-market-share/mobile-tablet/viet-nam
37. Apple: App Store Review Guidelines 2.5.6. https://developer.apple.com/app-store/review/guidelines/
38. Android Developers: DownloadListener. https://developer.android.com/reference/android/webkit/DownloadListener
39. Engineering at Meta: Launching a new Chromium-based WebView for Android (30/09/2022). https://engineering.fb.com/2022/09/30/android/launching-a-new-chromium-based-webview-for-android/
40. Felix Krause: iOS Privacy: Instagram and Facebook can track anything you do on any website in their in-app browser (08/2022). https://krausefx.com/blog/ios-privacy-instagram-and-facebook-can-track-anything-you-do-on-any-website-in-their-in-app-browser
41. Mã nguồn `ua-parser-js` 2.0.10, `src/main/ua-parser.js` (quy tắc Zalo, Facebook). https://cdn.jsdelivr.net/npm/ua-parser-js@2/src/main/ua-parser.js
42. (Thứ cấp) FPT Shop: Cách mở liên kết trên Zalo bằng trình duyệt web. https://fptshop.com.vn/tin-tuc/thu-thuat/cach-de-mo-lien-ket-tren-zalo-bang-trinh-duyet-web-164518
43. (Thứ cấp) Macone: Cách mở link trên Zalo bằng Chrome. https://macone.vn/tin-tuc/cach-mo-link-tren-zalo-bang-chrome/
44. Chrome for Developers: Android Intents with Chrome. https://developer.chrome.com/docs/android/intents
45. Zalo for Developers, cộng đồng: "Không mở được app deep link trên zalo". https://developers.zalo.me/community/detail/b07bc287fec2179c4ed3
46. (Thứ cấp) zaloweb.net: Tại sao không mở được file trên Zalo. https://zaloweb.net/tai-sao-khong-mo-duoc-file-tren-zalo/
47. Zalo Mini App, cộng đồng: Xét duyệt phiên bản App. https://miniapp.zaloplatforms.com/community/6656422433615073740/xet-duyet-phien-ban-app
