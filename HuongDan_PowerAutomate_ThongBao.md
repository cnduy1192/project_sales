# Hướng dẫn tích hợp thông báo Email qua Power Automate (Office 365)

Tài liệu này hướng dẫn dựng các flow Power Automate để tự động gửi email khi có
hoạt động khách hàng, báo cáo tuần và phản hồi báo cáo, cộng thêm một flow quét
đầu ngày nhắc các hoạt động chưa hoàn thành. Toàn bộ chạy trên Office 365, không
cần sửa mã nguồn phần mềm — Power Automate lắng nghe thay đổi trên các list
SharePoint mà phần mềm đang ghi vào.

---

## 0. Kiến trúc tổng quan

```
   Phần mềm (web)                SharePoint Lists              Power Automate            Office 365
 ─────────────────      ─────────────────────────────      ──────────────────      ─────────────────
  Ghi hoạt động     ──▶  Activities  (tạo / sửa item)  ──▶  Flow 1A / 1B      ──▶  Outlook: gửi email
  Gửi báo cáo       ──▶  Reports     (tạo item)        ──▶  Flow 2            ──▶  Manager + người tạo
  Phản hồi báo cáo  ──▶  ReportComments (tạo item)     ──▶  Flow 3            ──▶  Nhân viên
        —                Activities (quét theo lịch)   ──▶  Flow 4 (đầu ngày) ──▶  Nhân viên (+ manager)
                         Users (tra email theo tên)    ◀── mọi flow tra cứu
```

Có 5 flow:

1. **Flow 1A — Tạo hoạt động** → email cho manager (và người liên quan nếu được chọn).
2. **Flow 1B — Cập nhật hoạt động** → email cho manager (và người liên quan).
3. **Flow 2 — Gửi báo cáo tuần** → email cho manager và chính người tạo.
4. **Flow 3 — Manager phản hồi báo cáo** → email cho nhân viên (người gửi báo cáo).
5. **Flow 4 — Quét đầu ngày** → email nhắc các hoạt động chưa hoàn thành đã quá ngày.

---

## 1. Chuẩn bị trước khi dựng flow

### 1.1. Các list SharePoint và cột liên quan

Phần mềm dùng các list dưới đây (tên cột là **tên hiển thị** — trong Power Automate
bạn chọn cột từ danh sách gợi ý theo đúng tên này).

**List `Activities`** (hoạt động khách hàng)

| Cột hiển thị | Ý nghĩa |
|---|---|
| Sale phụ trách (PIC) | Người tạo/nhân viên phụ trách |
| Khách hàng | Khách hàng |
| Loại hoạt động | Call / Visit / Email / Exhibition |
| Ngày | Ngày diễn ra |
| Nội dung | Mục tiêu / nội dung |
| Kết quả / Next step | Bước tiếp theo |
| Mức độ tiềm năng | High / Medium / Low |
| Ngày hoàn thành | Rỗng = chưa hoàn thành |
| Người liên quan | Danh sách người liên quan, ngăn bằng dấu `;` |
| Các NCC quan tâm | Danh sách nhà cung cấp, ngăn bằng dấu `;` |

> Nếu list `Activities` **chưa có** hai cột **`Người liên quan`** và **`Các NCC
> quan tâm`**, hãy tạo chúng dạng **Multiple lines of text (Plain text)** đúng tên
> hiển thị này. Phần mềm đã ghi sẵn vào hai cột đó; flow sẽ đọc lại từ đây.

**List `Reports`** (báo cáo tuần)

| Cột hiển thị | Ý nghĩa |
|---|---|
| Title | Mã báo cáo |
| Người gửi | PIC người gửi |
| Tuần | Nhãn tuần (vd. 10/08 – 16/08/2026) |
| Ngày gửi | Ngày gửi |
| Nhận xét | Nội dung báo cáo |
| Người nhận | Danh sách người nhận (tên PIC, ngăn `;` hoặc `,`) |

**List `ReportComments`** (phản hồi báo cáo)

| Cột hiển thị | Ý nghĩa |
|---|---|
| Mã báo cáo | Trỏ về Title của Reports |
| Người viết | PIC người phản hồi |
| Vai trò | Vai trò người viết (manager / sales / …) |
| Nội dung | Nội dung phản hồi |

**List `Users`** (danh bạ + phân quyền — dùng để tra email)

| Cột hiển thị | Ý nghĩa |
|---|---|
| Title | **Email đăng nhập** của người dùng |
| Tên PIC | Tên gọi PIC (vd. "Thu") — dùng để đối chiếu |
| Tên đầy đủ | Họ tên đầy đủ |
| Vai trò | manager / sales / rnd / salesupport / superadmin / director |
| Báo cáo cho | Tên PIC của quản lý trực tiếp (line báo cáo) |

> **Điểm mấu chốt:** trong các list nghiệp vụ, người phụ trách được lưu bằng
> **tên PIC** (chuỗi), không phải email. Để gửi email, mọi flow đều tra list
> `Users`: `Tên PIC` = tên cần tìm → lấy `Title` (email).

### 1.2. Bật versioning (cho Flow 1B)

Vào **Activities → Settings → Versioning settings → Create a version each time you
edit an item = Yes**. Flow 1B cần lịch sử phiên bản để biết cột nào vừa thay đổi.

### 1.3. Kết nối (Connections)

Trong Power Automate tạo sẵn hai connection: **SharePoint** và **Office 365
Outlook**. Nên dùng một **tài khoản dịch vụ** (service account) để gửi mail cho
nhất quán, thay vì mailbox cá nhân. Nếu muốn gửi từ hộp thư dùng chung, dùng action
**"Send an email from a shared mailbox (V2)"**.

### 1.4. Mẫu tra email dùng lại (áp dụng trong mọi flow)

Bất cứ chỗ nào cần đổi **tên PIC → email**, dùng khối sau:

1. **Get items** — List `Users`
   - **Filter Query:** `Tên_PIC eq '<tên cần tìm>'`
     (chọn tên cột thật từ gợi ý; nếu tên có dấu nháy đơn thì gấp đôi: `O''Brien`).
   - **Top Count:** 1
2. Email chính là **Title** của item trả về:
   `@{first(outputs('Get_items_Users')?['body/value'])?['Title']}`

Với **manager của một PIC**: sau khi có item Users của PIC đó, đọc cột **`Báo cáo
cho`**:
- Nếu **có giá trị** → tra tiếp `Users` với `Tên PIC = [Báo cáo cho]` để lấy email.
- Nếu **rỗng** → Get items `Users` với `Filter Query: Vai_trò eq 'manager'` và gửi
  cho tất cả (giống logic phần mềm: không có line báo cáo thì gửi mọi quản lý).

> Gợi ý: đóng gói khối tra email thành **một child flow** ("Resolve email theo tên
> PIC", nhận input là tên, trả về email) rồi gọi lại ở cả 5 flow cho gọn. Nếu chưa
> quen child flow, cứ chép khối Get items vào từng flow.

---

## 2. Flow 1A — Khi tạo hoạt động khách hàng

**Mục tiêu:** Sale tạo hoạt động → gửi email cho **manager** của sale đó và các
**người liên quan** (nếu có).

1. **Trigger:** SharePoint — **When an item is created** → Site + List **Activities**.
2. **Get items (Users)** để lấy email của PIC tạo hoạt động
   - Filter Query: `Tên_PIC eq '@{triggerOutputs()?['body/Sale_phụ_trách']}'`
     (chọn cột `Sale phụ trách (PIC)` từ dynamic content thay cho phần trong nháy).
3. **Xác định manager:**
   - Đặt biến `varManagerEmail`.
   - Lấy `Báo cáo cho` từ item Users ở bước 2.
   - **Condition:** `Báo cáo cho` khác rỗng?
     - **Có:** Get items Users theo `Tên PIC = [Báo cáo cho]` → `varManagerEmail = Title`.
     - **Không:** Get items Users `Filter Query: Vai_trò eq 'manager'` → nối các
       Title thành chuỗi cách nhau bằng `;` (dùng **Select** → **Join**).
4. **Người liên quan (tuỳ chọn):**
   - Đặt biến chuỗi `varRelatedEmails = ''`.
   - **Condition:** cột `Người liên quan` khác rỗng?
     - **Apply to each** trên `split(triggerOutputs()?['body/Người_liên_quan'], ';')`:
       - `trim(item())` → Get items Users theo `Tên PIC` → nối email vào `varRelatedEmails`.
5. **Send an email (V2)** — Office 365 Outlook
   - **To:** `varManagerEmail`
   - **CC:** `varRelatedEmails` (nếu rỗng thì bỏ trống)
   - **Subject / Body:** xem mẫu ở **Mục 8 (Mẫu email — Hoạt động mới)**.

---

## 3. Flow 1B — Khi cập nhật hoạt động khách hàng

**Mục tiêu:** Sale sửa nội dung hoạt động → gửi email cho manager (và người liên
quan). Tránh gửi trùng với lúc tạo, và tránh gửi khi chỉ "đánh dấu hoàn thành".

1. **Trigger:** SharePoint — **When an item is created or modified** → List **Activities**.
2. **Chặn trường hợp vừa tạo (không phải sửa):** thêm **Condition** đầu tiên
   - Biểu thức bên trái:
     `sub(ticks(triggerOutputs()?['body/Modified']), ticks(triggerOutputs()?['body/Created']))`
   - Điều kiện: **is greater than** `100000000` (≈ 10 giây).
   - Chỉ đi tiếp nhánh **If yes** (tức là item đã tồn tại rồi mới sửa → là cập nhật).
     Việc "tạo mới" đã do Flow 1A xử lý.
3. **Get changes for an item or a file (properties only)**
   - **Id:** ID từ trigger.
   - **Since:** chọn token **Trigger Window Start Token** (có sẵn trong dynamic content).
   - Bước này trả về các cờ **"Has Column Changed: <tên cột>"**.
4. **Condition — chỉ báo khi nội dung thật sự đổi:**
   - `Has Column Changed: Nội dung` **is equal to** `true`
     **OR** `Has Column Changed: Kết quả / Next step` = true
     **OR** `Has Column Changed: Loại hoạt động` = true
     **OR** `Has Column Changed: Ngày` = true
     **OR** `Has Column Changed: Người liên quan` = true
   - Nếu chỉ có `Ngày hoàn thành` đổi (đánh dấu hoàn thành) → điều kiện sai → không gửi.
5. Trong nhánh **If yes**: lặp lại **bước 2–5 của Flow 1A** (tra email PIC → manager
   → người liên quan → Send email). Subject dùng mẫu **"Hoạt động vừa cập nhật"**.

> Nếu muốn đơn giản và chấp nhận báo mọi lần sửa: có thể bỏ bước 3–4 (Get changes)
> và chỉ giữ bước 2 (chặn lúc tạo). Nhưng khi đó thao tác "đánh dấu hoàn thành"
> cũng sẽ sinh email — nên khuyến nghị giữ bước lọc cột.

---

## 4. Flow 2 — Khi nhân viên gửi báo cáo tuần

**Mục tiêu:** Nhân viên gửi báo cáo → gửi email cho **manager (Người nhận)** và
**chính người tạo** (email xác nhận).

1. **Trigger:** SharePoint — **When an item is created** → List **Reports**.
2. **Người nhận (manager):** cột `Người nhận` là chuỗi tên PIC ngăn bằng `;` hoặc `,`.
   - Chuẩn hoá về `;`: `replace(triggerOutputs()?['body/Người_nhận'], ',', ';')`
   - **Apply to each** trên `split(...)` → tra `Users` từng tên → nối vào `varToEmails`.
   - Nếu `Người nhận` rỗng → lấy tất cả `Users` có `Vai trò eq 'manager'`.
3. **Người tạo:** tra `Users` theo `Tên PIC = [Người gửi]` → `varAuthorEmail`.
4. **Send an email (V2)**
   - **To:** `varToEmails`
   - **CC:** `varAuthorEmail` (bản xác nhận cho người tạo)
   - **Subject / Body:** mẫu **"Báo cáo tuần mới"** (Mục 8), chèn `Tuần`, `Người gửi`,
     `Nhận xét`, và link mở báo cáo trong phần mềm.

---

## 5. Flow 3 — Khi manager phản hồi báo cáo

**Mục tiêu:** Manager viết phản hồi → gửi email cho **nhân viên đã gửi báo cáo**.

1. **Trigger:** SharePoint — **When an item is created** → List **ReportComments**.
2. **Condition — chỉ khi người phản hồi là quản lý:**
   - `Vai trò` **is equal to** `manager`
     **OR** = `superadmin` **OR** = `director`.
   - (Nếu muốn báo cho mọi phản hồi từ người khác người gửi, có thể bỏ điều kiện này.)
3. **Tìm báo cáo gốc:** **Get items** — List **Reports**
   - Filter Query: `Title eq '@{triggerOutputs()?['body/Mã_báo_cáo']}'` → lấy `Người gửi`.
4. **Tra email nhân viên:** `Users` theo `Tên PIC = [Người gửi]` → `varAuthorEmail`.
5. **Send an email (V2)**
   - **To:** `varAuthorEmail`
   - **Subject / Body:** mẫu **"Phản hồi báo cáo"** (Mục 8), chèn `Người viết`,
     `Nội dung`, và link mở báo cáo.

---

## 6. Flow 4 — Quét đầu ngày: hoạt động chưa hoàn thành

**Mục tiêu:** Mỗi sáng, gửi cho từng nhân viên danh sách hoạt động **đã quá ngày mà
chưa hoàn thành** (giống định nghĩa "chưa hoàn thành" trong phần mềm: `Ngày < hôm
nay` và `Ngày hoàn thành` rỗng).

1. **Trigger:** **Recurrence**
   - Frequency: Day, Interval: 1.
   - **Time zone:** (UTC+07:00) Bangkok, Hanoi, Jakarta.
   - At these hours: **8**, At these minutes: **0** (8:00 sáng).
2. **Get items** — List **Activities**
   - **Filter Query** (cột `Ngày` là kiểu *Date only*):
     ```
     Ngày lt '@{formatDateTime(utcNow(),'yyyy-MM-dd')}' and Ngày_hoàn_thành eq null
     ```
     (chọn đúng tên cột `Ngày` và `Ngày hoàn thành`; `eq null` viết đúng như vậy,
     **không** đặt trong dấu nháy.)
   - Nếu cột `Ngày` là *Date and Time*, đổi mốc thành
     `'@{startOfDay(utcNow())}'`.
   - **Top Count:** 5000 và bật phân trang (Settings → Pagination) nếu dữ liệu lớn.
3. **Gom theo nhân viên:**
   - **Select** (Map) từ kết quả: `Sale phụ trách` → mảng tên.
   - **Compose** với `union(body('Select'), body('Select'))` để lấy **danh sách PIC
     duy nhất**.
   - **Apply to each** trên danh sách PIC duy nhất:
     - **Filter array** các item có `Sale phụ trách` = PIC hiện tại.
     - **Create HTML table** từ Filter array (chọn cột: Ngày, Khách hàng, Loại hoạt
       động, Nội dung) → làm phần thân email.
     - Tra `Users` để lấy email của PIC (và email manager nếu muốn CC).
     - **Send an email (V2):** To = email PIC, CC = email manager (tuỳ chọn),
       Subject/Body theo mẫu **"Nhắc việc chưa hoàn thành"** (Mục 8).
4. (Tuỳ chọn) Gửi thêm **một email tổng hợp cho manager** liệt kê toàn đội: dựng một
   Create HTML table từ toàn bộ Get items rồi gửi cho danh sách `Vai trò = manager`.

---

## 7. Chống trùng lặp & vòng lặp

- **Không tạo vòng lặp:** các flow trên chỉ **đọc** list `Users` và **gửi email** —
  không ghi ngược lại list `Activities`/`Reports`, nên không tự kích hoạt lại.
- **Tạo vs Sửa:** Flow 1A dùng trigger *created*; Flow 1B dùng *created or modified*
  nhưng chặn lần tạo bằng so sánh `Modified − Created` (bước 2 của Mục 3) để không
  gửi hai email cho cùng một lần tạo.
- **Đồng bộ nền của phần mềm:** khi phần mềm đẩy bản ghi lên SharePoint (đổi id,
  gắn dự án…), cột nội dung không đổi nên bộ lọc "Has Column Changed" ở Flow 1B sẽ
  bỏ qua — tránh email nhiễu.
- **Giới hạn tần suất:** nếu lo spam khi sửa nhiều lần, thêm cột phụ `Đã báo lúc`
  (Date/Time) và điều kiện chỉ gửi nếu lần sửa cách lần báo trước > X phút.

---

## 8. Mẫu email (song ngữ có thể rút gọn)

Dùng HTML trong **Body** của *Send an email (V2)*. Thay `[...]` bằng dynamic content.

**Hoạt động mới / vừa cập nhật**
```
Chủ đề: [Sale phụ trách] vừa ghi hoạt động với [Khách hàng]

Xin chào,
[Sale phụ trách] vừa [ghi mới / cập nhật] một hoạt động khách hàng:

• Khách hàng: [Khách hàng]
• Loại: [Loại hoạt động]   • Ngày: [Ngày]
• Nội dung: [Nội dung]
• Bước tiếp theo: [Kết quả / Next step]
• Người liên quan: [Người liên quan]

Mở phần mềm để xem chi tiết: https://<địa-chỉ-app-của-bạn>
```

**Báo cáo tuần mới**
```
Chủ đề: Báo cáo tuần [Tuần] — [Người gửi]

[Người gửi] đã gửi báo cáo tuần [Tuần].
Nội dung: [Nhận xét]

Mở mục Báo cáo trong phần mềm để đọc và phản hồi.
```

**Phản hồi báo cáo**
```
Chủ đề: Quản lý đã phản hồi báo cáo của bạn

[Người viết] vừa phản hồi báo cáo tuần của bạn:
"[Nội dung]"

Mở mục Báo cáo để xem toàn bộ trao đổi.
```

**Nhắc việc chưa hoàn thành (đầu ngày)**
```
Chủ đề: Bạn có [số lượng] hoạt động chưa hoàn thành

Chào [Tên đầy đủ],
Các hoạt động sau đã quá ngày mà chưa được đánh dấu hoàn thành:

[Bảng HTML: Ngày | Khách hàng | Loại | Nội dung]

Vào phần mềm để cập nhật hoặc đánh dấu hoàn thành.
```

---

## 9. Kiểm thử từng flow

1. **Flow 1A/1B:** tạo một hoạt động thử trên phần mềm với một PIC có `Báo cáo cho`
   trong Users → kiểm tra manager nhận mail; sửa nội dung → nhận mail cập nhật;
   đánh dấu hoàn thành → **không** phát sinh mail.
2. **Flow 2:** gửi một báo cáo tuần → manager (theo `Người nhận`) và người gửi cùng
   nhận mail.
3. **Flow 3:** đăng nhập tài khoản manager, phản hồi một báo cáo → người gửi nhận mail.
4. **Flow 4:** tạo một hoạt động có `Ngày` = hôm qua, để trống `Ngày hoàn thành` →
   chạy tay flow (Run) → PIC nhận email nhắc.
5. Dùng **Run history** để xem input/output từng bước khi có lỗi (thường là sai
   Filter Query hoặc tên cột).

---

## 10. Ghi chú về phần mềm (không bắt buộc sửa code)

- Phần mềm **đã** ghi sẵn: `Người nhận` trên Reports, `Người liên quan` và `Các NCC
  quan tâm` trên Activities, `Vai trò` trên ReportComments, và `Báo cáo cho` trên
  Users. Các flow dựa hoàn toàn vào những cột này.
- Việc duy nhất cần làm ở phía SharePoint là **tạo hai cột text** `Người liên quan`
  và `Các NCC quan tâm` trên list `Activities` nếu chưa có (Mục 1.1), và **bật
  versioning** (Mục 1.2).
- Toast trong phần mềm ghi "Thông báo gửi qua Email & Microsoft Teams" sẽ trở thành
  đúng sự thật sau khi các flow này hoạt động. Nếu muốn gửi cả **Teams**, thêm action
  **Post message in a chat or channel** song song với Send email trong cùng flow.
