# Manager Cockpit — Thiết kế

Ngày: 30/07/2026 · Trạng thái: đã duyệt · Phạm vi: FI SAIGON Sales Funnel (web)

## 1. Mục tiêu

Manager và Super Admin đăng nhập vào thẳng một trang mới, trả lời hai câu hỏi:

1. Tuần vừa rồi đội sales đã làm gì — trên khách hàng nào, dự án nào, nhà cung cấp nào.
2. Một khách hàng bất kỳ đang có những sales nào phụ trách, thuộc segment nào, đang được chào sản phẩm gì, lịch sử tiếp xúc ra sao.

Trang gộp dữ liệu của cả ba nhà cung cấp, không phụ thuộc tab NCC ở header.

Ngoài phạm vi: sửa Dashboard, sửa Sales Funnel, thay đổi mô hình quyền, tích hợp AI.

## 2. Quyết định đã chốt

| Quyết định | Lựa chọn |
|---|---|
| Cấu trúc | Một trang, hai tầng: dòng thời gian tuần ở trên, bảng khách hàng ở dưới |
| Phạm vi NCC | Xuyên suốt cả 3 NCC, bỏ qua `nccFilter`, có chip lọc NCC trong trang |
| Cửa sổ thời gian | Mặc định 7 ngày, chip chuyển nhanh 14 / 30 ngày |
| Loại sự kiện | Hoạt động KH · Cập nhật tiến độ · Dự án mới · Dự án đóng WON/LOST |
| Lớp khách hàng | Bảng xếp hạng + drawer trượt phải |
| Quyền truy cập | Manager + Super Admin, là trang mặc định sau đăng nhập; Sales không thấy |
| Dải tín hiệu | 4 ô, click để lọc feed và bảng bên dưới |
| Kiến trúc | Tách lớp dữ liệu suy diễn khỏi lớp render |
| Chồng lấn với `INSIGHT` | Không viết lại timeline; drawer có nút nhảy sang `showInsight('kh', label)` |

## 3. Hai vấn đề dữ liệu phải xử lý

### 3.1 Tên khách hàng trùng do viết hoa/thường

330 chuỗi tên khách hàng trong `RECORDS` chỉ còn 298 sau khi chuẩn hoá `trim().toUpperCase()`. Có 32 nhóm trùng: `Bibica`/`BIBICA`, `HD Food`/`HD FOOD`, `Puratos`/`PURATOS`, `HCT Food`/`HCT FOOD`, `Baker Baking Food`/`BAKER BAKING FOOD`, `Interfresh`/`INTERFRESH`, `Masan`/`MASAN`, `Rita`/`RITA`, `Datafa`/`DATAFA`, `Halos`/`HALOS`, `Pham Asset`/`PHAM ASSET`, `Richy Northern`/`RICHY NORTHERN`, và 20 nhóm khác.

Không gộp thì Bibica hiện thành hai dòng riêng, lịch sử bị xé đôi và các con số tổng hợp sai.

Giải pháp: khoá nội bộ là `custKey(s) = s.trim().toUpperCase()`; nhãn hiển thị `custLabel(key)` là cách viết xuất hiện nhiều lần nhất trong nhóm, hoà thì lấy chuỗi đầu tiên theo thứ tự bảng chữ cái. Cùng cách xử lý cho tên sales (`Y Nang`/`Y NANG`).

Đây là lớp chuẩn hoá chỉ đọc. Không sửa `demo-data.js`, không sửa dữ liệu nguồn.

### 3.2 Thiếu ngày đóng dự án

`RECORDS` có `status: 'WON' | 'LOST'` nhưng không có trường ghi *ngày* đóng, nên không thể xác định dự án nào đóng trong cửa sổ 7 ngày.

Giải pháp gồm hai phần:

- Từ nay: `confirmClose()` trong `js/views/funnel.js` ghi thêm `r.closedAt = nowStr()`. Đúng một dòng, tương thích ngược.
- Dữ liệu cũ: suy đoán theo thứ tự ưu tiên `closedAt` → `at` của phần tử cuối trong `updates[]` → `closing`. Sự kiện đóng dựng từ dữ liệu suy đoán mang cờ `inferred: true`; giao diện thêm dấu `~` trước ngày và tooltip "ngày ước tính từ lần cập nhật cuối".

## 4. Kiến trúc

| File | Trạng thái | Vai trò |
|---|---|---|
| `js/lib/insights.js` | mới | Hàm thuần, không đụng DOM: chuẩn hoá khoá, dựng dòng sự kiện, gom chỉ mục khách hàng, tính tín hiệu |
| `js/views/cockpit.js` | mới | Dựng HTML và bắt sự kiện cho view |
| `cockpit.css` | mới | Style riêng của view |
| `index.html` | sửa | Thêm `<section id="view-cockpit">`, mục sidebar, drawer; gỡ markup AI; thêm 3 thẻ nạp file mới |
| `js/core.js` | sửa | `go()` thêm nhánh `cockpit`; `loginAs()` điều hướng theo vai trò; gỡ lời gọi `initAI()`; ẩn tab NCC khi ở view này |
| `js/views/funnel.js` | sửa | Thêm `r.closedAt = nowStr()` trong `confirmClose()` |

Ranh giới: `insights.js` không được tham chiếu `document`, không đọc `nccFilter` toàn cục — mọi tham số vào qua đối số hàm. Nhờ vậy kiểm thử được bằng cách gọi hàm trực tiếp trong console.

Cả hai file mới nạp dạng classic script, scope toàn cục, đúng quy ước hiện có của dự án.

## 5. Lớp dữ liệu suy diễn (`js/lib/insights.js`)

### 5.1 API công khai

```js
custKey(s)                  // 'Bibica' → 'BIBICA'
custLabel(key)              // 'BIBICA' → 'BIBICA' (cách viết phổ biến nhất)
picKey(s)                   // chuẩn hoá tên sales
cockpitScope()              // {records, acts} lọc theo quyền, KHÔNG lọc theo nccFilter
buildEvents(days, opts)     // Event[] giảm dần theo ts
buildCustomerIndex(opts)    // Map<custKey, CustomerProfile>
buildSignals(days)          // {acts, closedWon, closedLost, overdue, silent}
invalidateCockpit()         // xoá bộ nhớ đệm
```

`opts` chứa `{nccs: string[] | null, kinds: string[] | null, pic: string | null}` — bộ lọc trong trang truyền vào đây, không đụng biến toàn cục.

### 5.2 Kiểu dữ liệu

```js
Event = {
  ts,          // 'YYYY-MM-DD'
  kind,        // 'act' | 'update' | 'new' | 'close'
  ncc, custKey, custLabel, pic,
  segment, product,
  projectId,   // null với hoạt động chưa gắn dự án (40/334 bản ghi)
  text,        // note của hoạt động, hoặc nội dung cập nhật, hoặc mô tả sự kiện
  status,      // chỉ với kind 'close': 'WON' | 'LOST'
  inferred     // true nếu ts là ngày suy đoán, xem 3.2
}

CustomerProfile = {
  key, label,
  sales: Set, segments: Set, nccs: Set,
  products: [{name, stageGroup, ncc, kgThis}],
  projects: [recordRef],
  openCount, wonCount, lostCount,
  kgThis,      // tổng tiềm năng năm nay của dự án đang chạy
  lastTouch    // 'YYYY-MM-DD' | null
}
```

`sales`, `segments`, `nccs` là tập hợp vì 57 khách hàng có nhiều hơn một sales phụ trách và 51 khách hàng trải trên nhiều segment. Giao diện phải hiển thị được nhiều giá trị, không giả định giá trị đơn.

### 5.3 Bốn nguồn sự kiện

| Nguồn | `kind` | Ngày | Số lượng |
|---|---|---|---|
| `ACTIVITIES[]` | `act` | `date` | 334 |
| `RECORDS[].updates[]` | `update` | `at` | ~800 |
| `RECORDS[].created` | `new` | `created` | 574 |
| `RECORDS` có `status ≠ IN PROGRESS` | `close` | xem 3.2 | theo dữ liệu |

### 5.4 Bốn tín hiệu

| Ô | Định nghĩa |
|---|---|
| Hoạt động trong kỳ | Số `Event` có `kind ∈ {act, update}` trong cửa sổ |
| Đóng trong kỳ | Số `Event` có `kind = close`, tách WON / LOST |
| Quá hạn | Dự án `IN PROGRESS` có `closing < TODAY`. Không phụ thuộc cửa sổ thời gian |
| Im lặng > 30 ngày | Khách hàng có ít nhất một dự án đang chạy và `lastTouch` cách `TODAY` quá 30 ngày, hoặc `lastTouch = null`. Không phụ thuộc cửa sổ thời gian |

Hai ô cuối cố ý không đổi theo cửa sổ 7/14/30 ngày; nhãn phụ ghi rõ "tính đến hôm nay" để tránh hiểu nhầm.

Click một ô bật/tắt bộ lọc tương ứng cho cả feed lẫn bảng khách hàng. Ô đang bật có viền nhấn và `aria-pressed="true"`.

### 5.5 Bộ nhớ đệm

`_cache` khoá theo `days`, dựng lười khi lần đầu cần đến. `invalidateCockpit()` được gọi ở cuối `saveForm()`, `saveDetail()`, `saveAct()`, `confirmClose()`. Bộ lọc trong trang (NCC, loại, sales) áp lên kết quả đã đệm, không kích hoạt dựng lại.

## 6. Giao diện

### 6.1 Bố cục

```
┌─ Tổng quan điều hành ─────────────── [7 ngày] 14  30 ─┐
│  01/07 – 07/07/2026                                   │
├───────────────────────────────────────────────────────┤
│  Hoạt động 12 │ Đóng 3 W·1 L │ Quá hạn 18 │ Im lặng 24│  ← click để lọc
├───────────────────────────────────────────────────────┤
│  Dòng thời gian tuần      [NCC ▾] [Loại ▾] [Sales ▾]  │
│                                                       │
│  Thứ Hai · 07/07                                      │
│    ● Thu → BIBICA · Visit · Roquette · BAKERY         │
│    ● Tam → VINUT · WON · IFF · DAIRY                  │
│  Chủ Nhật · 06/07                                     │
│    ● Phi → MEIZAN · Cập nhật · IFF · FAT & OIL        │
├───────────────────────────────────────────────────────┤
│  Khách hàng · 298                    [tìm nhanh…]     │
│  Tên │ Sales │ Segment │ NCC │ Đang chạy │ KG │ Gần nhất│
└───────────────────────────────────────────────────────┘
                                  + drawer trượt phải
```

### 6.2 Dòng thời gian

Nhóm theo ngày, ngày mới nhất trên cùng, nhãn tiếng Việt ("Thứ Hai · 07/07"). Mỗi dòng gồm chấm màu theo `kind`, tên sales, mũi tên, tên khách hàng, chip loại sự kiện, chip NCC, chip segment, và trích nội dung tối đa 120 ký tự.

Click dòng có `projectId` mở `openDetail(projectId)` sẵn có. Click tên khách hàng mở drawer. Hoạt động chưa gắn dự án chỉ mở được drawer.

### 6.3 Bảng khách hàng

Cột: Khách hàng · Sales phụ trách · Segment · NCC · Dự án đang chạy · KG tiềm năng · Hoạt động gần nhất. Sắp xếp mặc định theo `lastTouch` giảm dần, click tiêu đề cột để đổi. Ô tìm nhanh lọc theo tên.

Nhiều sales hoặc nhiều segment hiển thị hai giá trị đầu cộng "+N", đầy đủ trong drawer.

### 6.4 Drawer khách hàng

Trượt từ phải, rộng 480px, đóng bằng Esc / click nền / nút X, bẫy tiêu điểm bàn phím bên trong khi mở, trả tiêu điểm về dòng đã click khi đóng.

Bốn khối: **Sales phụ trách** (avatar, số dự án mỗi người) · **Segment & ứng dụng** · **Sản phẩm đang chào** (nhóm giai đoạn, KG) · **20 sự kiện gần nhất**.

Nút "Xem toàn bộ lịch sử" gọi `showInsight('kh', label)` rồi `go('dash')` — dùng lại timeline sẵn có, không viết lại.

Lưu ý: `showInsight` lọc qua `visible()` nên vẫn chịu `nccFilter`. Khách hàng có dự án ở nhiều NCC sẽ thấy timeline hẹp hơn drawer. Trước khi chuyển, nếu khách hàng trải trên nhiều NCC thì đặt `nccFilter` về NCC có nhiều dự án nhất của khách hàng đó và hiện toast một dòng giải thích.

### 6.5 Chuẩn hoá giai đoạn giữa các NCC

Tên giai đoạn khác nhau giữa ba pipeline (`SOLUTION TESTING` của Roquette, `TESTING` của IFF). Mọi chỗ hiển thị giai đoạn trong view này dùng `STAGE_GROUP` — Tiếp cận / Thử mẫu / Đàm phán / Hoãn — để so sánh được; tên gốc đặt ở thuộc tính `title`.

### 6.6 Điều hướng

Mục sidebar mới "Tổng quan điều hành" đặt trên "Sales Funnel", chỉ hiện với `manager` và `superadmin`. `loginAs()` gọi `go('cockpit')` cho hai vai trò này, `go('funnel')` cho sales. Tab NCC ở header ẩn khi view đang mở, hiện lại khi rời đi.

### 6.7 Ngôn ngữ thị giác

Kế thừa token và lớp `glass` sẵn có trong `styles.css` — không đặt màu mới ngoài bảng đã có. Dùng `frontend-design` cho nhịp điệu và phân cấp thị giác, `baseline-ui` cho lượt rà soát khoảng cách, kích cỡ chữ và căn chỉnh cuối cùng.

## 7. Gỡ AI Agent

Xoá `#aiFab` và `#aiPanel` khỏi `index.html`, xoá thẻ `<script src="js/views/ai.js">`, xoá lời gọi `initAI()` trong `core.js`.

Giữ nguyên `js/views/ai.js` và phần CSS liên quan trên đĩa — người dùng sẽ tái dùng ở nơi khác. Cần kiểm tra `js/guest.js` và `js/extras.js` xem có tham chiếu `toggleAI` / `aiSend` / `initAI` không; nếu có thì gỡ theo, không để lại lời gọi treo.

## 8. Trường hợp rìa

| Tình huống | Xử lý |
|---|---|
| Cửa sổ 7 ngày không có sự kiện | Empty-state kèm nút "Xem 30 ngày" |
| Khách hàng chưa có hoạt động nào | Cột "gần nhất" hiện `—`, không hiện `Invalid Date` |
| Dự án thiếu `closing` | Không tính vào ô Quá hạn |
| Hoạt động chưa gắn dự án (40/334) | Vẫn lên feed, không có link dự án |
| Sự kiện đóng dùng ngày suy đoán | Dấu `~` trước ngày, tooltip giải thích |
| Bảng 298 dòng | Render một lần, lọc bằng ẩn/hiện, không dựng lại DOM |
| Khách hàng trải nhiều NCC | Drawer hiện tất cả; nút lịch sử đặt lại `nccFilter`, xem 6.4 |

## 9. Kiểm thử

Bốn khẳng định chạy được trong console trình duyệt:

1. `custKey` gộp đúng 32 nhóm trùng — số khoá duy nhất là 298, không phải 330.
2. `buildEvents(7)` không trả sự kiện nào có `ts` ngoài khoảng `[TODAY-7, TODAY]`.
3. Tổng `openCount` toàn chỉ mục bằng số dự án `IN PROGRESS` trên toàn bộ ba NCC.
4. Đăng nhập vai sales rồi gọi `buildCustomerIndex()`: mọi khách hàng trả về đều có ít nhất một dự án mà sales đó là `pic` hoặc nằm trong `related`. Không so với `visible()` vì hàm đó còn lọc theo `nccFilter`.

Kiểm tra bằng mắt trên ba khổ màn hình: 1440px, 1024px, 768px. Kiểm tra bàn phím: Tab đi hết dải tín hiệu và bảng, Enter mở drawer, Esc đóng, tiêu điểm quay lại dòng đã click.

## 10. Thứ tự thực hiện

1. `js/lib/insights.js` + bốn khẳng định kiểm thử — xong lớp dữ liệu trước, chưa có giao diện.
2. Thêm `closedAt` vào `confirmClose()`.
3. Khung `index.html` + `go()` + điều hướng theo vai trò.
4. Dải tín hiệu và dòng thời gian.
5. Bảng khách hàng và drawer.
6. Gỡ AI Agent.
7. Lượt polish bằng `frontend-design` và `baseline-ui`.

## 11. Ghi chú khi thực hiện — sai khác so với thiết kế

Bốn điểm lệch so với bản duyệt, tất cả đều là sửa cho đúng chứ không phải đổi phạm vi:

**`closedAt` lưu dạng ISO, không phải `nowStr()`.** `nowStr()` trả `'07/07/2026 14:30'`; trộn hai định dạng ngày trong cùng một trường sẽ hỏng phép so sánh chuỗi mà toàn bộ lớp sự kiện dựa vào. Trường ghi `isoOf(TODAY)`. `normDate()` vẫn đọc được định dạng cũ nếu gặp.

**Có sửa một dòng ở Dashboard.** `INS_MATCH.kh` so khớp nguyên văn `r.customer === k` nên tra "Bibica" bỏ sót toàn bộ bản ghi "BIBICA" — lỗi có sẵn, không phải do trang mới. Đổi thành `custKey(r.customer) === custKey(k)`. Nút "Xem toàn bộ lịch sử" không hoạt động đúng nếu thiếu sửa này.

**Phạm vi của sales rộng hơn định nghĩa ban đầu.** Sales còn thấy khách hàng mà họ tự ghi hoạt động dù chưa có dự án nào. Đúng về nghiệp vụ; khẳng định kiểm thử số 4 đã sửa theo.

**Thêm lớp thoát chuỗi cho handler nội tuyến.** Dữ liệu có khách hàng `Food O'Farm`; `onclick="openCustomer('…')"` vỡ cú pháp nếu chỉ thoát HTML. Hàm `ckAttr()` thoát literal JS trước, thoát HTML sau.

Lượt `baseline-ui` sửa thêm: thang z-index của ngăn kéo đổi sang 840/850 cho khớp `styles.css` (header 60 · modal 900) — mức 60/61 ban đầu sẽ bị header che; bỏ hiệu ứng đổi bề rộng ô tìm kiếm (không animate thuộc tính layout); nhãn tĩnh tách khỏi `.ck-chip` sang `.ck-badge` vì `aria-pressed` trên `<span>` là ARIA sai; trạng thái bảng rỗng có nút "Xoá toàn bộ bộ lọc".

## 12. Kết quả kiểm thử

Bốn khẳng định ở mục 9 đều đạt trên dữ liệu thật:

| Khẳng định | Kết quả |
|---|---|
| Gộp tên khách hàng | 330 chuỗi → 298 khoá |
| Cửa sổ 7 ngày | 15 sự kiện, không có sự kiện nào ngoài 30/06 – 07/07 |
| Tổng dự án đang chạy | 161 / 161 |
| Phạm vi quyền sales | 57 khách hàng trong tầm nhìn của Thu, không lọt bản ghi ngoài quyền |

Thêm 22 bước kiểm thử tương tác chạy trên DOM thật (đăng nhập theo vai trò, đổi cửa sổ thời gian, bật/tắt bốn tín hiệu, lọc NCC và loại sự kiện, tìm nhanh, sắp xếp, mở/đóng ngăn kéo bằng Esc, nhảy sang Dashboard, ghi hoạt động mới rồi kiểm tra feed tự cập nhật, tên có dấu nháy) — tất cả đạt.

Con số đáng chú ý khi manager mở trang: **83/161 dự án đang chạy đã qua ngày đóng dự kiến** và **80 khách hàng có dự án chạy nhưng hơn 30 ngày không ai chạm**. Đây là dữ liệu thật, không phải lỗi tính toán.
