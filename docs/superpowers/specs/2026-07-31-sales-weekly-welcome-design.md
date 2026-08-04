# Màn hình chào tuần cho Sales + mục Báo cáo — Thiết kế

Ngày: 31/07/2026 · Trạng thái: đã duyệt · Phạm vi: FI SAIGON Sales Funnel (web)

## 1. Mục tiêu

Sales đăng nhập gặp một popup phủ rộng trả lời đúng câu hỏi của ngày hôm đó:

- **Thứ Hai** — tuần này tôi nên làm gì? Kèm nút tạo nhanh, gắn sẵn khách hàng / dự án / segment.
- **Thứ Ba đến thứ Năm** — hôm nay có việc gì, việc nào đã trôi qua mà chưa đánh dấu.
- **Thứ Sáu** — tuần vừa rồi tôi đã làm gì, dự án đổi gì, và gửi báo cáo cho manager.

Kèm một mục **Báo cáo** trong sidebar: sales soạn và xem báo cáo của mình, manager xem của cả đội.

Ngoài phạm vi vòng này: AI. Người dùng chọn dùng luật thuần trước, gắn AI sau khi Cloudflare Worker đã deploy. Xem mục 10.

## 2. Quyết định đã chốt

| Quyết định | Lựa chọn |
|---|---|
| Phạm vi | Một spec, tách code thành ba tầng độc lập |
| Mô hình kế hoạch | Kế hoạch là ACTIVITY ngày tương lai + trường `done` |
| Ngày giữa tuần | Có chế độ riêng, bám kế hoạch |
| Tần suất popup | Mỗi ngày một lần cho mỗi người |
| AI | Chưa dùng ở vòng này |
| Đầu ra báo cáo | Mục Báo cáo riêng, gửi cho manager trong phần mềm |
| Mục Báo cáo | Một view chung, nội dung theo vai trò |
| Lưu trữ | localStorage |
| Kiến trúc | Lớp đè bền vững + tách module, tái dùng `insights.js` |

## 3. Ba sự thật về dữ liệu định hình thiết kế

### 3.1 Tuần hiện tại gần như trống

`TODAY` = 07/07/2026, **thứ Ba**. Tuần chứa nó là 06–12/07.

| | Thu | Tam |
|---|---|---|
| Hoạt động trong tuần | 0 | 0 |
| Hoạt động ngày tương lai | 8 | 6 |
| Dự án đang chạy | 34 | 24 |
| Quá hạn ngày đóng | 9 | 13 |
| Đóng trong 30 ngày tới | 0 | 2 |

Cả đội chỉ có 3 hoạt động trong tuần này (Phi, Lan, Hiệp mỗi người một). Mọi khối trong popup phải có empty-state tử tế, và chế độ thứ Hai — "bắt đầu từ trang giấy trắng" — mới là chế độ đúng với thực tế dữ liệu.

### 3.2 Ngưỡng cố định vô dụng với dữ liệu này

`updates[]` của mọi dự án dừng ở 01/06/2026, tức 36 ngày trước `TODAY`. Luật "dự án chưa cập nhật quá 30 ngày" sẽ gắn cờ **34/34 dự án đang chạy của Thu**.

Nên `suggestWork()` **cho điểm rồi lấy top N**, không dùng ngưỡng nhị phân. Cách này còn đúng cả khi dữ liệu về sau dày lên.

### 3.3 Không có ngày nào là thứ Hai hay thứ Sáu để thử

`TODAY` cố định là thứ Ba, nên hai nhánh chính không bao giờ tự kích hoạt. Popup có công tắc xem trước ba chế độ ở thanh tiêu đề — không phải tính năng phụ mà là điều kiện để nghiệm thu được.

## 4. Kiến trúc

| File | Trạng thái | Vai trò |
|---|---|---|
| `js/lib/localstore.js` | mới | Lớp đè bền vững: hoạt động sales tạo tại chỗ, cờ `done`, danh sách báo cáo |
| `js/lib/weekly.js` | mới | Hàm thuần: mốc tuần, tổng hợp tuần của một sales, luật xếp hạng, dựng báo cáo |
| `js/views/welcome.js` | mới | Popup ba chế độ |
| `js/views/reports.js` | mới | Mục Báo cáo |
| `welcome.css` | mới | Style popup và mục Báo cáo |
| `index.html` | sửa | Markup popup + view `reports` + mục sidebar; nạp 5 file mới |
| `js/core.js` | sửa | Nhánh `go('reports')`, mục sidebar theo vai trò, gọi popup sau đăng nhập |
| `js/views/activities.js` | sửa | `openActForm(prefill)` nhận tham số tuỳ chọn |
| `js/components/notifications.js` | sửa | Thêm `notifyPlain(action, to[])` |

Ranh giới giữ như `insights.js`: `weekly.js` và `localstore.js` không tham chiếu `document`, không đọc biến lọc toàn cục.

`weekly.js` dùng lại của `insights.js`: `custKey`, `custLabel`, `picKey`, `picLabel`, `normDate`, `isoOf`, `shiftISO`, `daysSince`, `buildCustomerIndex`. Không viết lại hàm nào trong số đó.

Thứ tự nạp: `insights.js` → `localstore.js` → `weekly.js` → các view.

## 5. Lớp đè bền vững (`js/lib/localstore.js`)

### 5.1 Hình dạng

```js
{
  v: 1,                                    // phiên bản, để migrate về sau
  acts:    [ {…activity, id:'AL-0001'} ],  // hoạt động sales tạo tại chỗ
  done:    { 'A-0123':'2026-07-08', … },   // id hoạt động → ngày đánh dấu đã làm
  reports: [ …Report… ]
}
```

Khoá localStorage: `fisg_local_<email>`. Mỗi người một khoá — demo chuyển vai trò qua lại không giẫm lên nhau.

### 5.2 API

```js
LS.load()                    // đọc, tự vá khi dữ liệu hỏng
LS.mergeActs()               // nối LS.acts vào ACTIVITIES nếu chưa có
LS.addAct(a)                 // ghi hoạt động mới, tiền tố id 'AL-'
LS.markDone(id, iso)         // đặt/gỡ cờ đã làm
LS.isDone(a)                 // suy ra trạng thái, xem 5.3
LS.addReport(r) / LS.reports(pic)
LS.available()               // false khi trình duyệt chặn storage
```

### 5.3 Suy ra trạng thái đã làm

Theo thứ tự:

1. Có trong `done` → đã làm.
2. Ngày ≤ hôm nay → đã làm. 334 bản ghi cũ không có cờ, mặc định này giữ chúng đúng nghĩa.
3. Ngày > hôm nay → là kế hoạch, chưa làm.

Hệ quả cần biết: một kế hoạch quá ngày mà sales không bấm gì sẽ tự chuyển thành "đã làm" theo luật 2. Để chế độ giữa tuần vẫn nhắc được, `buildMyWeek` tách riêng nhóm `missed` = hoạt động **do sales tạo tại chỗ** (`AL-`), ngày ≤ hôm nay, chưa có trong `done`. Chỉ hoạt động tạo trong phần mềm mới phân biệt được kế hoạch với thực tế; dữ liệu nhập sẵn thì không, và không giả vờ là có.

### 5.4 Nối thêm, không ghi đè

`LS.mergeActs()` chỉ `push` bản ghi có id chưa tồn tại trong `ACTIVITIES`. `store.js` khi tráo dữ liệu SharePoint thật vào sẽ thay toàn bộ mảng — nên `mergeActs()` được gọi lại sau mỗi lần store hoàn tất, việc sales vừa nhập không bị nuốt mất.

Trình duyệt chặn localStorage: mọi thứ chạy trong bộ nhớ, popup hiện một dòng "Trình duyệt đang chặn lưu trữ — việc bạn nhập sẽ mất khi tải lại trang."

## 6. Mô hình tuần (`js/lib/weekly.js`)

### 6.1 API

```js
weekBounds(iso) → {start, end, label}     // thứ Hai → Chủ Nhật
dayMode(iso) → 'mon' | 'mid' | 'fri'      // T2 → mon · T3–T5 → mid · T6/T7/CN → fri
buildMyWeek(pic, weekStart) → MyWeek
suggestWork(pic, limit) → Suggestion[]
buildReport(pic, weekStart) → Report
```

`weekBounds` tính bằng số học ngày, không phụ thuộc locale — Chủ Nhật (`getDay()===0`) lùi 6 ngày, không phải 0.

### 6.2 MyWeek

```js
{
  start, end,
  planned: [],          // ngày > hôm nay, trong tuần
  today:   [],          // ngày = hôm nay
  done:    [],          // trong tuần, đã làm
  missed:  [],          // AL-*, ngày ≤ hôm nay, chưa đánh dấu — xem 5.3
  projectChanges: [],   // updates / created / closed trong tuần, của dự án sales phụ trách
  stats: { planned, done, missed, changes, overdue }
}
```

### 6.3 Luật xếp hạng

`suggestWork(pic, 5)` cho điểm rồi lấy top 5. Một khách hàng chỉ xuất hiện một lần, giữ điểm cao nhất.

| Tín hiệu | Điểm |
|---|---|
| Dự án quá hạn ngày đóng | `100 + số ngày quá hạn` |
| Dự án đóng trong 30 ngày tới | `60 + (30 − số ngày còn lại)` |
| Khách hàng im lặng | `30 + số ngày im lặng / 10` |
| Dự án lâu chưa cập nhật | `20 + số ngày / 10` |

Trừ điểm để tránh trùng việc: khách hàng đã có kế hoạch trong tuần này bị trừ 200 điểm — tức rơi khỏi danh sách, vì việc đó đã nằm trong lịch rồi.

```js
Suggestion = { key, custKey, custLabel, projectId, segment, ncc, score, reason, action }
```

`reason` là một câu tiếng Việt đọc được: "Quá hạn ngày đóng 34 ngày" · "Im lặng 62 ngày". `action` là `'schedule'` hoặc `'update'`, quyết định nút nào hiện ra.

## 7. Popup

### 7.1 Bố cục

```
┌─ Chào Thu · Thứ Ba 07/07/2026 ────── [T2][Giữa tuần][T6]  ✕ ─┐
│  Tuần 06 – 12/07 · 0 đã làm · 8 kế hoạch · 9 dự án quá hạn   │
├───────────────────────────────────────────────────────────────┤
│  ▸ 5 việc nên làm tuần này                                    │
│    BIBICA · Quá hạn ngày đóng 34 ngày · P-0231                │
│                                   [Đặt lịch] [Mở dự án]       │
│    VINUT · Im lặng 62 ngày                    [Đặt lịch]      │
│  ─────────────────────────────────────────────────────────    │
│  ▸ Đã có trong lịch tuần này · 8                              │
├───────────────────────────────────────────────────────────────┤
│                          [Bỏ qua]  [Vào Sales Funnel]         │
└───────────────────────────────────────────────────────────────┘
```

Rộng `min(1040px, 94vw)`, cao tối đa `88dvh`, thân cuộn trong.

### 7.2 Ba chế độ

**`mon` — Lên kế hoạch tuần.** 5 việc đề xuất, mỗi việc một nút hành động; bên dưới là danh sách đã có trong lịch. Trống thì: "Tuần này chưa có gì trong lịch — bắt đầu từ 5 việc trên."

**`mid` — Bám kế hoạch.** Ba khối: việc hôm nay · còn lại trong tuần · kế hoạch quá ngày chưa đánh dấu (mỗi dòng có nút "Đã làm" mở form ghi kết quả). Không còn việc nào thì hiện 3 đề xuất từ `suggestWork`.

**`fri` — Bản nháp báo cáo.** Đã làm · trượt · thay đổi dự án · hai biểu đồ. Nút chính "Mở mục Báo cáo" chuyển sang trình soạn với số liệu đã điền sẵn.

Công tắc `[T2][Giữa tuần][T6]` ghi đè chế độ để xem trước; chế độ thật vẫn suy từ `dayMode(todayISO())`.

### 7.3 Xuất hiện

Sau `loginAs()`, nếu `me.role === 'sales'` và `fisg_wc_seen_<email>` khác ngày hôm nay thì mở popup và ghi lại ngày. Mục sidebar "Tổng quan tuần" mở lại bất cứ lúc nào, không ghi cờ.

Manager và Admin không tự động thấy popup — họ đã có Cockpit. Nhưng mở tay được từ sidebar, ở chế độ chỉ đọc (không có `me.pic` nên không tạo được hoạt động), kèm một dòng giải thích.

### 7.4 Tầng và bàn phím

`z-index` 860 (nền) / 870 (hộp) — trên ngăn kéo Cockpit (850), dưới `.overlay` của modal dự án (900) để form tạo nhanh mở đè lên được. Esc đóng, bẫy tiêu điểm bên trong, trả tiêu điểm về nơi đã bấm.

## 8. Tạo nhanh

Nút "Đặt lịch" gọi `openActForm(prefill)`. `openActForm()` hiện xoá trắng mọi trường; thêm tham số tuỳ chọn:

```js
openActForm({ customer, ncc, date, projectId, note, potential })
```

Không truyền gì thì hành vi y như cũ. Ngày mặc định là ngày làm việc tiếp theo trong tuần, không phải hôm nay — vì đây là *lên lịch*.

Hoạt động lưu qua `saveAct()` sẵn có, sau đó `LS.addAct()` ghi vào lớp đè và `cockpitRefresh()` cập nhật màn hình manager. Nút "Mở dự án" gọi `openDetail(projectId)`.

## 9. Mục Báo cáo

### 9.1 Nội dung theo vai trò

**Sales** — danh sách báo cáo của mình theo tuần, nút "Soạn báo cáo tuần" mở trình soạn.
**Manager / Admin** — toàn bộ báo cáo của đội, lọc theo sales và theo tuần, bấm để đọc chi tiết.

### 9.2 Bản ghi

```js
Report = {
  id:'R-…', pic, picLabel, weekStart, weekEnd, createdAt,
  stats: { done, missed, changes, overdue, newProjects, won, lost },
  doneActs: [], missedActs: [], projectChanges: [],
  note,                    // sales tự viết
  to: []                   // tên manager nhận
}
```

Số liệu chốt tại thời điểm gửi, không tính lại khi đọc — báo cáo là ảnh chụp, không phải truy vấn.

### 9.3 Gửi

Tạo một `NOTIFS` qua `notifyPlain(action, to[])` — hàm mới đặt cạnh `notify()`, vì `notify()` lấy người nhận từ một dự án và báo cáo thì không gắn với dự án nào. Không sửa `notify()`.

Người nhận là mọi tài khoản `role === 'manager'` hoặc `'superadmin'` trong `USERS`.

### 9.4 Biểu đồ

Dùng Chart.js đã nạp sẵn, theo khuôn `donut()` của `dashboard.js`:

1. Hoạt động trong tuần theo loại (Call / Visit / Email / Seminar / Khác).
2. Dự án đang chạy theo nhóm giai đoạn (Tiếp cận / Thử mẫu / Đàm phán / Hoãn).

Biểu đồ thứ hai luôn có dữ liệu kể cả tuần trống — đó là lý do nó được chọn thay vì một biểu đồ hoạt động thứ hai. Biểu đồ rỗng dùng `chartEmpty()` sẵn có.

## 10. Chỗ dành sẵn cho AI

Vòng này không gọi AI, nhưng thiết kế chừa chỗ để gắn sau mà không phải viết lại:

- `suggestWork()` trả dữ liệu có cấu trúc, không phải HTML — AI có thể xếp lại thứ tự hoặc viết `reason` hay hơn mà không đụng lớp giao diện.
- `buildReport()` trả bản ghi có cấu trúc — AI viết phần văn xuôi cho trường `note` là đủ.
- `aiContext()` trong `ai.js` hiện gửi toàn bộ 574 dự án. Khi gắn AI cho sales, phải thu hẹp về đúng phạm vi của người đó, nếu không sales sẽ hỏi được dữ liệu ngoài quyền xem.

## 11. Trường hợp rìa

| Tình huống | Xử lý |
|---|---|
| Tuần trống hoàn toàn | Mỗi khối có empty-state kèm một hành động |
| Không có `me.pic` (manager mở tay) | Chế độ chỉ đọc, ẩn nút tạo, kèm dòng giải thích |
| localStorage bị chặn | Chạy trong bộ nhớ, báo một dòng trong popup |
| Tuần vắt qua giao thừa năm | `weekBounds` tính bằng số học ngày, không cắt theo năm |
| Chủ Nhật đăng nhập | `dayMode` trả `'fri'` — cuối tuần vẫn là lúc nhìn lại |
| Ngày sai định dạng | `normDate()` xử lý, bản ghi hỏng bị bỏ qua chứ không làm vỡ trang |
| `store.js` tráo dữ liệu SharePoint | Gọi lại `LS.mergeActs()` sau khi store xong |
| Hoạt động trùng id sau khi tải lại | `mergeActs` bỏ qua id đã tồn tại |

## 12. Kiểm thử

Khẳng định chạy được trong console:

1. `weekBounds('2026-07-07')` trả 06/07 – 12/07; `weekBounds('2027-01-01')` (thứ Sáu) trả 28/12/2026 – 03/01/2027.
2. `dayMode` ánh xạ đúng bảy ngày trong tuần.
3. `buildMyWeek('Thu', '2026-07-06')` không trả bản ghi nào có ngày ngoài khoảng.
4. `suggestWork('Thu', 5)` trả tối đa 5 mục, không trùng khách hàng, điểm giảm dần.
5. Khách hàng đã có kế hoạch trong tuần không xuất hiện trong `suggestWork`.
6. `LS.addAct()` rồi `LS.load()` lại — bản ghi còn nguyên; `mergeActs()` gọi hai lần không nhân đôi.
7. Sales không đọc được báo cáo của sales khác.

Kiểm thử tương tác trên DOM: đăng nhập vai sales mở đúng popup; ba chế độ đổi được bằng công tắc; nút "Đặt lịch" mở form đã điền sẵn khách hàng; lưu xong hoạt động xuất hiện ở mục Hoạt động và ở Cockpit của manager; đánh dấu "Đã làm" sống sót sau khi dựng lại; gửi báo cáo sinh thông báo và hiện trong mục Báo cáo của manager; Esc đóng popup và trả tiêu điểm.

Kiểm tra bằng mắt trên 1440 / 1024 / 768.

## 13. Thứ tự thực hiện

1. `localstore.js` + kiểm thử lưu trữ.
2. `weekly.js` + bảy khẳng định — xong lớp dữ liệu trước, chưa có giao diện.
3. `openActForm(prefill)` và `notifyPlain()`.
4. Khung popup + `dayMode` + công tắc xem trước.
5. Ba chế độ nội dung.
6. Mục Báo cáo: danh sách, trình soạn, gửi, biểu đồ.
7. Lượt polish bằng `frontend-design` và `ui-ux-pro-max`.

## 14. Ghi chú khi thực hiện

### 14.1 Một lỗi có sẵn được sửa luôn

`saveAct()` sinh id theo `'A-' + (ACTIVITIES.length+1)`. Dữ liệu có 334 hoạt động, nên hoạt động mới nhận id `A-0335` — **id đã tồn tại**. Mọi bản ghi người dùng nhập đều trùng id với một bản ghi có sẵn.

Đổi sang `LS.nextActId()` với tiền tố `AL-`. Vừa hết trùng, vừa là thứ đánh dấu bản ghi do người dùng nhập — cơ chế duy nhất phân biệt được kế hoạch với thực tế, xem 5.3.

### 14.2 Bốn điểm lệch so với thiết kế

**`lastTouchMap` tự tính, không mượn `buildCustomerIndex`.** Hàm đó suy phạm vi từ biến toàn cục `me`, còn ở đây `pic` là tham số. Mượn thì manager xem thử tuần của người khác sẽ ra số của chính manager. Các helper còn lại (`custKey`, `picKey`, `normDate`, `isoOf`, `daysSince`, `closeStamp`) vẫn dùng lại nguyên.

**Hoà điểm thì xếp theo KG.** Vì `closing` dồn về 01/06/2026 nên rất nhiều dự án quá hạn *đúng bằng* 36 ngày, điểm bằng nhau. Xếp theo bảng chữ cái là tuỳ tiện; xếp theo tiềm năng KG mới ra thứ tự đáng làm trước. Với Thu, LOF (500.000 KG) nhờ vậy lên trên ACECOOK VN (500 KG).

**`LS.reset()` không xoá bộ nhớ tạm khi trình duyệt chặn lưu trữ.** Lúc đó bộ nhớ tạm *là* dữ liệu duy nhất — xoá nó là mất trắng việc vừa nhập. Phát hiện khi chạy test trên môi trường không có localStorage.

**Popup dùng `visibility` thay `display` để ẩn.** Đổi `display:none` sang `flex` cùng lúc với `transform` thì trình duyệt bỏ qua transition — hiệu ứng mở không bao giờ chạy. Đây là lỗi thật, không phải chi tiết thẩm mỹ.

### 14.3 Một hành vi đúng dễ bị tưởng là lỗi

Kế hoạch ngày mai **không** xuất hiện trong dòng thời gian Cockpit của manager. Đúng: Cockpit trả lời "tuần vừa rồi đội đã làm gì", còn kế hoạch là việc chưa xảy ra. Nếu sau này manager cần thấy lịch sắp tới của đội, đó là một tính năng riêng.

Đổi lại, hai màn hình vẫn ăn khớp: sales đặt lịch cho một khách → khách đó rời khỏi nhóm "im lặng" ở Cockpit ngay (80 → 79 trong lần chạy thử).

### 14.4 Lượt polish

Vùng bấm 36px trên desktop, 44px khi popup chiếm nguyên màn hình (≤820px). Hiệu ứng mở 200ms `ease-out`, tắt hoàn toàn khi bật `prefers-reduced-motion`; biểu đồ cũng bỏ animation trong chế độ đó. Mỗi biểu đồ có chú giải, tooltip đúng đơn vị và một dòng tóm tắt bằng chữ cho trình đọc màn hình. Mọi trạng thái rỗng có một hành động. Dòng chữ dài giới hạn 78ch. `z-index` 860/870 — trên ngăn kéo Cockpit (850), dưới modal dự án (900).

## 15. Kết quả kiểm thử

Tám khẳng định của `weeklyAssert()` đạt với cả Thu và Tam:

| Khẳng định | Kết quả |
|---|---|
| Mốc tuần thứ Ba | 06/07 → 12/07 |
| Mốc tuần qua giao thừa | 28/12/2026 → 03/01/2027 |
| Chủ Nhật thuộc tuần trước đó | 06/07 → 12/07 |
| Ánh xạ chế độ bảy ngày | mon,mid,mid,mid,fri,fri,fri |
| Không có bản ghi ngoài tuần | đạt |
| Đề xuất ≤5, không trùng khách | 5 mục |
| Điểm giảm dần, hoà thì KG lớn trước | đạt |
| Khách đã có lịch bị loại | đạt |

23 bước kiểm thử tương tác trên DOM thật đều đạt: sales đăng nhập popup tự mở đúng chế độ giữa tuần; đổi được cả ba chế độ; bấm "Đặt lịch" mở form đã điền sẵn khách hàng, NCC, dự án và ngày làm việc kế tiếp; lưu xong ghi vào localStorage với id `AL-0001` và hiện trên dải bảy ngày; đánh dấu "Đã làm" rồi hoàn tác; dữ liệu sống sót qua `reset()` và `mergeActs()` gọi hai lần không nhân đôi; soạn và gửi báo cáo sinh thông báo tới đúng hai manager; manager đọc được, sales khác không; manager mở popup ở chế độ chỉ đọc; Esc đóng và trả tiêu điểm. Cộng năm bước hồi quy xác nhận Cockpit, mục Hoạt động và Dashboard không bị ảnh hưởng.
