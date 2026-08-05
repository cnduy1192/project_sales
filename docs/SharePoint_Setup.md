# Chuyển sang chạy hoàn toàn trên SharePoint

Ngày: 04/08/2026

Dữ liệu demo đã bị gỡ bỏ. `js/data/demo-data.js` (493 KB) đã xoá; bốn tài khoản demo trong `config.js` cũng đã bỏ.

Thay vào đó là `js/data/catalog.js`, chỉ giữ phần **cấu hình nghiệp vụ**: quy trình bán hàng của từng nhà cung cấp, nhóm giai đoạn, % mặc định, cây phân khúc thị trường. Đây không phải dữ liệu demo — chúng mô tả cách FI Saigon làm việc, hiếm khi đổi, và không nên phụ thuộc vào việc có tồn tại list nào trên SharePoint hay không.

Từ giờ **không đăng nhập Microsoft 365 thì không có dữ liệu nào**. Đây là hành vi đúng, không phải lỗi.

## 1. Việc bạn cần làm trên SharePoint

### 1.1 Tạo list `Users` — bắt buộc

Không có list này thì không ai được gán vai trò sales, và toàn bộ phần cá nhân hoá (Kế hoạch tuần, phạm vi xem của sales, gợi ý việc) không hoạt động.

Site: `fisaigonvn.sharepoint.com/sites/SalesProjectTracker` → **New → List** → đặt tên `Users`.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `Title` | Single line of text | có | Email đăng nhập M365. Ví dụ `thu@fisaigon.vn` |
| `Email` | Single line of text | không | Dùng khi không muốn để email ở cột Title |
| `Role` | Choice | có | `sales` · `rnd` · `manager` · `director` · `superadmin` |
| `PICName` | Single line of text | **không** | Tên tắt như nó nằm trong dữ liệu. Xem 1.1c |
| `FullName` | Single line of text | **không** | Tên đầy đủ O365. App tự điền, không phải gõ |

Chỉ cần tạo **một dòng duy nhất** cho tài khoản quản trị của bạn:

| Title | Role |
|---|---|
| duy.chengoc@fisaigon.vn | superadmin |

Những người còn lại thêm thẳng trong app — xem mục 1.1b. Không phải gõ tay trên SharePoint nữa.

### 1.1b Thêm người dùng ngay trong app

Đăng nhập bằng tài khoản superadmin → **Người dùng & phân quyền** → **Thêm người dùng**.

Nhập email rồi bấm **Tra O365**. App lấy tên hiển thị từ Microsoft 365, điền sẵn vào ô PIC, và **đối chiếu ngay** với cột PIC trong dữ liệu dự án:

- *"Tên này khớp cột PIC trong dữ liệu"* → xong, không phải làm gì thêm.
- *"Chưa có dự án nào ghi PIC là …"* kèm vài tên gần đúng → sửa ô PIC cho khớp.

Bấm **Lưu lên SharePoint** là dòng mới xuất hiện trong list `Users`. Đổi vai trò ngay trên bảng, hoặc xoá người bằng nút Xoá — mọi thay đổi đi thẳng lên SharePoint.

Ghi hỏng (mất mạng, thiếu quyền) thì app **hoàn tác lại trên màn hình** và báo lý do, chứ không để bạn tưởng đã lưu.

Hai điều app cố tình chặn: không xoá được chính mình, và tự hạ quyền mình xuống dưới superadmin thì phải xác nhận — vì cả hai đều làm bạn mất luôn màn hình này.

### 1.1c Đổi tên PIC tắt thành tên đầy đủ

Dữ liệu cũ ghi tên tắt: cột PIC của dự án là `Bich Ngoc`, trong khi O365 gọi người đó là `Phạm Bích Ngọc`. App **đổi khi hiển thị**, không sửa dữ liệu trên SharePoint.

Khai một lần trong màn Người dùng & phân quyền:

| Ô | Điền gì |
|---|---|
| Tên đầy đủ (O365) | Tự điền khi bấm Tra O365 |
| Tên PIC như trong dữ liệu | `Bich Ngoc` — chỉ điền khi dữ liệu ghi tên tắt |

**Một người có nhiều tên tắt thì ngăn bằng dấu phẩy.** Funnel ghi cùng một người khi thì `Ngoc`, khi thì `Bich Ngoc` — điền `Ngoc, Bich Ngoc` là cả hai đều hiện thành `Phạm Bích Ngọc`, và người đó thấy được cả hai nhóm dự án của mình.

Từ đó mọi màn hình — funnel, hoạt động, Cockpit, báo cáo — đều hiện `Phạm Bích Ngọc`. Bảng người dùng ghi rõ *Dữ liệu ghi "Bich Ngoc" → hiển thị "Phạm Bích Ngọc"* để bạn nhìn ra ai đang được đổi tên.

Nếu dữ liệu đã ghi đúng tên đầy đủ thì **để trống ô PIC** — Tra O365 cũng cố tình không tự điền ô này.

### 1.1d Năm vai trò

| Vai trò | Phạm vi dữ liệu | Sửa | Đóng dự án | Cockpit | Kế hoạch tuần | Phân quyền |
|---|---|---|---|---|---|---|
| Sales | dự án mình là PIC | ✓ | ✓ | — | ✓ | — |
| R&D | dự án mình phụ trách R&D | ✓ | — | — | ✓ | — |
| Manager | toàn đội | ✓ | ✓ | ✓ | — | — |
| Director | toàn đội | — | — | ✓ | — | — |
| Super Admin | toàn đội | ✓ | ✓ | ✓ | ✓ | ✓ |

**R&D bám cột `RnDOwner`** ("R&D phụ trách") trong list Projects — cột này đã có sẵn nhưng trước đây app không đọc. Không có giá trị trong đó thì người R&D không thấy dự án nào.

**Super Admin thấy mọi menu**, kể cả Kế hoạch tuần, để kiểm tra được màn hình của sales. Nhưng popup không tự bật mỗi sáng — đó là nhịp làm việc của sales, không phải của quản trị; mở bằng mục sidebar khi cần.

**Director đọc được cả đội nhưng không nhập liệu**: không nút Lưu, không đóng dự án. Vẫn nhận báo cáo tuần của sales.

Vai trò ghi sai chính tả trong list sẽ rơi vào mặc định chặt nhất — không thấy gì, không sửa gì — thay vì âm thầm được cấp quyền xem toàn công ty.

### PIC lấy từ đâu

**Mặc định, PIC chính là tên hiển thị O365 của người đăng nhập.** Cột PIC trong list Projects là trường Person, SharePoint trả về đúng tên đầy đủ ấy — nên hai bên tự khớp, không phải khai gì.

Cột `PICName` chỉ dùng khi tên O365 **khác** giá trị PIC trong dữ liệu: người đổi tên, hoặc dữ liệu cũ còn ghi tên viết tắt (`Bich Ngoc` thay vì `Phạm Bích Ngọc`). Khi có giá trị, `PICName` thắng; tên hiển thị trên giao diện vẫn là tên O365.

App tự kiểm tra sau mỗi lần tải: nếu tên O365 của bạn không khớp giá trị PIC nào trong dữ liệu, nó báo ngay trên màn hình kèm các tên gần đúng, thay vì để bạn ngồi nhìn một danh sách dự án trống mà không hiểu vì sao. Muốn xem chi tiết thì gõ trong Console:

```js
picMatchReport(me.pic)
```

Nếu chưa kịp tạo list, app **không khoá cửa**: `ADMIN_EMAIL` trong `sp-config.js` vào với quyền superadmin, người khác vào với quyền manager. Màn hình Người dùng & phân quyền sẽ báo rằng thay đổi chỉ nằm trong phiên hiện tại.

### 1.2 List `Pipelines` — tuỳ chọn

**Không bắt buộc.** Quy trình bán hàng ba nhà cung cấp đã nằm sẵn trong `js/data/catalog.js`:

| NCC | Giai đoạn |
|---|---|
| Roquette | SHARED BUSINESS GOAL → BUILDING A SOLUTION → SOLUTION TESTING → OFFER & AGREEMENT |
| IFF | LEAD → SAMPLE SENT → TESTING → TEST PASSED → QUOTED / PO |
| Kimica | LEAD → SAMPLE SENT → TESTING → TEST PASSED → QUOTED / PO → POSTPONED |

Kèm nhóm giai đoạn (Tiếp cận · Thử mẫu · Đàm phán · Hoãn) và % mặc định của từng giai đoạn.

Tạo list `Pipelines` chỉ khi muốn **sửa quy trình mà không phải sửa code**. Khi list tồn tại và đọc được, nó thay thế toàn bộ bảng trên. App đọc theo tên cột:

| Cột | Kiểu | Dùng để |
|---|---|---|
| `Supplier` | Text hoặc Lookup → Suppliers | Pipeline thuộc NCC nào |
| `Stage` hoặc `Title` | Single line of text | Tên giai đoạn |
| `StageOrder` | Number | Thứ tự trong quy trình |
| `StageGroup` | Choice | `Tiếp cận` · `Thử mẫu` · `Đàm phán` · `Hoãn` |
| `WinProbability` | Number | % mặc định khi chọn giai đoạn này |

Dù có list hay không, giai đoạn nào xuất hiện trong dữ liệu mà cả hai nguồn đều chưa khai sẽ **được thêm vào cuối** danh sách của NCC đó, kèm cảnh báo trên màn hình — để không dự án nào biến mất khỏi funnel chỉ vì thiếu khai báo.

### 1.3 Các list còn lại

`Projects`, `Activities`, `ProjectUpdates`, `Suppliers`, `Customers`, `Products` giữ nguyên như cũ — phần map đã chạy từ trước, không đổi.

## 2. Danh mục giờ suy từ dữ liệu thật

Trước đây nhà cung cấp, segment, khách hàng, sản phẩm, danh sách sales đều là hằng số nhúng trong code. Giờ tất cả dựng lại sau mỗi lần tải:

| Danh mục | Nguồn |
|---|---|
| Khách hàng, sản phẩm, ứng dụng | Projects + Activities |
| Sales (ô người liên quan) | Cột PIC trong Projects + Activities |
| Nhà cung cấp (tab NCC) | `js/data/catalog.js`, cộng thêm NCC mới thấy trong Projects |
| Nhóm ngành → Segment | `js/data/catalog.js`, cộng thêm segment mới thấy trong Projects |
| Giai đoạn, nhóm, % mặc định | `js/data/catalog.js`, hoặc list Pipelines nếu có — xem 1.2 |

Bốn danh mục cuối là **cấu hình**, không phải dữ liệu: chúng mô tả cách công ty làm việc, nằm trong `js/data/catalog.js` và luôn có mặt kể cả khi chưa đăng nhập. Dữ liệu thật chỉ **bổ sung** cái mới, không xoá cái đã khai.

Hệ quả: **thêm một NCC mới trên SharePoint là app tự có tab mới**, không cần sửa code.

## 3. Khách hàng trùng tên

Bạn chọn dọn thẳng trên SharePoint, nên app **không tự gộp**. Nhưng nó chỉ ra được chỗ cần dọn.

Sau khi đăng nhập, mở Console (F12) và gõ:

```js
FISG_STORE.findDuplicateCustomers()
```

Hàm này bỏ dấu tiếng Việt, bỏ các hậu tố pháp nhân (`CÔNG TY`, `TNHH`, `CP`, `JSC`, `CO.,LTD`, `VN`, `VIỆT NAM`, `GROUP`…) rồi gom các tên rút về cùng một gốc. Kết quả in ra theo nhóm:

```
=== Khách hàng nghi trùng tên: 1 nhóm / 4 tên ===
  ACECOOK VN   ≡   Acecook   ≡   Acecook VN   ≡   CÔNG TY TNHH ACECOOK VIỆT NAM
```

Đây là **gợi ý, không phải kết luận**. `IDP` và `IDP (LOF)` có thể là hai pháp nhân khác nhau — bạn quyết định.

Cách dọn trên SharePoint:

1. Chạy hàm trên, chép danh sách nhóm ra.
2. Trong list `Customers`, chọn một tên chuẩn cho mỗi nhóm.
3. Sửa lookup `Customer` của các Projects/Activities đang trỏ vào tên phụ sang tên chuẩn.
4. Xoá các dòng Customers thừa.
5. Tải lại app rồi chạy lại hàm để xác nhận nhóm đó đã biến mất.

Lưu ý về cùng khách khác Segment: một khách hàng **được phép** có nhiều segment. Cockpit và ngăn kéo khách hàng đã hiển thị nhiều segment cho một khách. Bạn chỉ cần gộp phần **tên**, không cần gộp segment.

App vẫn tự gộp phần hoa/thường và khoảng trắng thừa (`Bibica` = `BIBICA` = `bibica `). Chỉ khác biệt về từ ngữ mới cần bạn xử lý.

## 3b. Xoá dữ liệu mẫu còn sót trong list Activities

Trong code **không còn** dữ liệu demo nào. Nhưng một số hoạt động mẫu đã từng
được nạp lên list `Activities` lúc thử nghiệm, nên chúng vẫn hiện trên Tổng quan
như sự kiện thật (seminar, Zalo… đầu tháng 8/2026).

Mở Console sau khi đăng nhập:

```js
FISG_STORE.findSeedActivities()      // liệt kê, KHÔNG xoá gì
FISG_STORE.deleteSeedActivities()    // xoá thật, có hộp xác nhận, chỉ Super Admin
```

Hàm dò theo **nội dung ghi chú** trùng đúng chuỗi dữ liệu mẫu cũ, nên hoạt động
thật của bạn không bị đụng tới. Cứ chạy hàm đầu tiên trước, đọc danh sách, thấy
đúng ba dòng đó thì mới chạy hàm thứ hai. Muốn chắc chắn hơn thì xoá tay trong
list `Activities` trên SharePoint — hàm in kèm id để bạn tra.

## 3c. Cột "Người liên quan" quyết định ai xem được dự án

Sales **chỉ thấy dự án của chính mình**. Muốn một sales xem được dự án của đồng
nghiệp, thêm tên họ vào cột `Người liên quan` (`RelatedPeople`) của dự án đó —
họ sẽ thấy cả dự án lẫn toàn bộ hoạt động gắn với nó. Manager, Director và Super
Admin luôn thấy tất cả.

Cột này nhận cả ba dạng: Person nhiều giá trị, nhiều dòng text, hay một ô text
ngăn cách bằng dấu phẩy/chấm phẩy. Tên phải khớp với `Tên PIC` hoặc `Tên đầy đủ`
trong list `Users` (không phân biệt hoa thường và dấu tiếng Việt).

Phạm vi này áp ở **mọi** chỗ, không chỉ bảng Sales Funnel: popup chi tiết khách
hàng, danh sách hoạt động, mở thẳng một dự án bằng mã, và cả bản chụp của link
chia sẻ công khai. Sales mở popup một khách hàng chung sẽ chỉ thấy phần của
mình — kể cả số đếm dự án ở đầu popup cũng chỉ đếm phần đó, vì con số cũng là
thông tin.

## 3f. Danh bạ khách hàng theo chủ sở hữu

Mỗi khách hàng thuộc về một sales; sales không thấy khách của nhau. Dữ liệu này
nằm trong list `Customers`, thêm hai cột:

| Cột | Kiểu | Tên hiển thị |
|---|---|---|
| `Owner` | Single line of text | `Người phụ trách` |
| `LegalName` | Single line of text | `Tên pháp nhân` |

`Title` = tên gọn (đã bỏ "Công ty TNHH", "Cổ phần", "Hộ kinh doanh"…). `Owner` =
tên PIC của sales phụ trách (khớp cột PIC trong list Users). `LegalName` = tên
pháp nhân đầy đủ, để sau này xuất hóa đơn hay đối chiếu.

### Nhập 388 khách hàng một lần

Tôi đã tạo sẵn `Customers_Import.xlsx` từ file bạn gửi: mỗi dòng có `Tên gọn
(Title)`, `Tên pháp nhân (LegalName)`, `Chủ sở hữu (Owner)`, và một cột `Tên gốc`
để bạn đối chiếu. Cách nhập:

1. Mở `Customers_Import.xlsx`, rà cột `Tên gọn` — dòng nào cắt chưa vừa ý thì
   sửa tay (388 dòng, 0 dòng rỗng, 0 khách bị hai sales cùng sở hữu — file đã
   kiểm).
2. Bỏ cột `Tên gốc` (chỉ để đối chiếu).
3. Trong list `Customers`, dùng **Edit in grid view** hoặc **Import from Excel**
   dán ba cột Title / LegalName / Owner.
4. Tải lại app. Vào **Khách hàng của tôi** — mỗi sales thấy đúng khách của mình.

Muốn tạo lại file (nếu đổi thuật toán làm gọn):
`python3 tools/make_customers_import.py Customer_Data.xlsx Customers_Import.xlsx`

### Phân quyền cộng thêm

Sau khi có cột Owner, một sales thấy dự án/hoạt động nếu: là PIC, HOẶC là người
liên quan, HOẶC **là chủ sở hữu khách hàng đó**. Ba đường cộng lại — chủ sở hữu
chỉ mở rộng, không gỡ quyền ai. Khách chưa có trong danh bạ (chưa gán chủ) giữ
nguyên phân quyền theo PIC dự án.

Khách hàng gõ tay mới trong app tự gán chủ sở hữu = sales đang đăng nhập, ghi
tên gọn vào Title và tên gốc vào LegalName.

## 3d. App ghi ngược lên SharePoint — cột bắt buộc

Cho tới bản 05/08/2026 phần mềm chỉ **đọc**: mọi hoạt động sales nhập chỉ nằm
trong `localStorage` của chính trình duyệt đó, nên quản lý không bao giờ thấy;
dự án tạo hoặc sửa trong app thì mất hẳn khi tải lại trang. Nay app ghi thật.

Thao tác nào ghi vào đâu:

| Thao tác trong app | List | Kiểu |
|---|---|---|
| Ghi hoạt động | `Activities` | tạo dòng mới |
| Bấm "Hoàn thành" ở Kế hoạch tuần | `Activities` | cập nhật cột `Ngày hoàn thành` |
| Gắn hoạt động vào dự án | `Activities` | cập nhật cột `Dự án liên quan` |
| Thêm dự án | `Projects` | tạo dòng mới |
| Sửa giai đoạn / tiến độ / ngày đóng / KG | `Projects` | cập nhật |
| Đóng dự án | `Projects` | cập nhật `Trạng thái` + `Kết quả` |
| Bình luận, đổi giai đoạn, đóng dự án | `ProjectUpdates` | tạo dòng nhật ký |
| Khách hàng / nguyên liệu mới gõ tay | `Customers`, `Products` | tạo dòng mới (gán chủ sở hữu) |

**App không bao giờ tự tạo dòng trong `Suppliers`.** Danh sách nhà cung cấp là cố
định, và "Khác" không phải một NCC nên hoạt động gắn "Khác" sẽ để trống cột NCC.

Về tên cột: app **tự dò internal name** theo tên hiển thị tiếng Việt (SharePoint
mã hoá tên cột tiếng Việt thành kiểu `OData__x004e_CC`), nên bạn không cần đổi
tên cột. Cột nào không tìm thấy thì app **bỏ qua field đó và cảnh báo ở Console**
chứ không làm hỏng thao tác lưu — nhưng dữ liệu ở cột đó sẽ trống. Sau lần ghi
đầu tiên, mở F12 xem có dòng `[store] list ... không có cột:` nào không.

Riêng người phụ trách: app ghi vào cột `PICName` nếu list có cột đó, không thì ghi
vào cột `Sale phụ trách` **với điều kiện đó là cột text**. Nếu bạn để nó là cột
Person thì app không ghi được tên và sẽ cảnh báo — cách gọn nhất là thêm một cột
text tên `PICName` vào cả `Projects`, `Activities` và `ProjectUpdates`.

Cột `Người liên quan` của `Projects`: app thử ghi dạng text ngăn cách bằng dấu
chấm phẩy. Nếu đó là cột Person, SharePoint từ chối và app **vẫn tạo dự án** rồi
báo ở Console — dự án không mất, chỉ thiếu cột đó.

## 3e. Cột "Ngày hoàn thành" — BẠN CẦN TẠO

Trạng thái hoàn thành của một hoạt động phải là dữ liệu dùng chung, không phải
ghi chú riêng trong trình duyệt của từng người. Tạo thêm **một cột** trong list
`Activities`:

| Cột | Kiểu | Tên hiển thị |
|---|---|---|
| `CompletedDate` | **Date and Time** (chỉ Date là đủ) | `Ngày hoàn thành` |

Rỗng = chưa xong. Có ngày = sales đã bấm **Hoàn thành** hôm đó.

Chọn kiểu Date thay vì Yes/No vì nó trả lời được cả câu "xong lúc nào" — thứ báo
cáo cuối tuần và Tổng quan cần, mà một ô đánh dấu không có.

**Trước khi có cột này** app vẫn chạy: trạng thái lưu tạm trong trình duyệt, và
app nói thẳng "chưa dùng chung được" mỗi lần bấm. **Sau khi tạo cột**, những gì
đã đánh dấu trước đó sẽ tự đẩy lên ở lần đăng nhập kế tiếp — không phải bấm lại.

App đọc sơ đồ cột một lần mỗi phiên. Vừa tạo cột xong mà app đang mở thì bấm F5,
hoặc gõ `FISG_STORE.forgetSchema()` trong Console.

### Khi đọc về mất tên khách hàng / NCC

Nếu trên SharePoint nhìn thấy đủ mà trong app cột Khách hàng hoặc NCC trống, đó
là **cột lookup dò trượt tên**: SharePoint hay đặt internal name khác tên hiển
thị (`Customer0` khi tên `Customer` đã bị dùng, hoặc mã hoá tên tiếng Việt thành
`OData__x004e_CC`). App nay dò tên cột ở cả hai chiều đọc và ghi, và tự cảnh báo
ở Console khi quá nửa số bản ghi rỗng ở một trường lookup:

```
[store] 4/5 bản ghi Activities không đọc được "Customer" — cột đang dò: KHÔNG TÌM THẤY.
```

Gặp dòng này thì chạy `FISG_STORE.debug('Activities')`, gửi tôi danh sách cột.

### Khi ghi hỏng

Hoạt động vừa nhập hiện nhãn vàng **"chưa đồng bộ"** trong bảng Customer
Activities, kèm một thông báo nói rõ quản lý chưa thấy việc này. Nó nằm lại trong
máy và **tự thử lại ở lần đăng nhập sau**. Muốn đẩy ngay thì mở Console:

```js
FISG_STORE.pushPendingActs()
```

Dự án thì không có hàng chờ: nếu ghi hỏng, app báo ngay và dự án chỉ đang nằm
trên màn hình — tải lại trang là mất. Đây là chủ ý: giấu một dự án hỏng vào hàng
chờ nguy hiểm hơn là nói thẳng.

## 4. Chẩn đoán khi có trục trặc

Sau khi đăng nhập app **không hiện thông báo gì** — tải xong là im lặng, đúng như mong đợi. Số liệu và cảnh báo đi vào Console (F12):

| Lệnh | Cho biết |
|---|---|
| `FISG_STORE.debug('Activities')` | Tên cột thật của một list và một bản ghi mẫu (mặc định `Projects`) |
| `picMatchReport(me.pic)` | Tên O365 của bạn có khớp cột PIC trong dữ liệu không |
| `FISG_STORE.picAliasMap()` | Bảng đổi tên tắt → tên đầy đủ đang áp dụng |
| `myCap()` | Năng lực của vai trò bạn đang đăng nhập |
| `FISG_STORE.canWriteUsers()` | App có ghi được lên list Users không |
| `FISG_STORE.findDuplicateCustomers()` | Nhóm khách hàng nghi trùng tên |
| `FISG_STORE.findSeedActivities()` | Hoạt động trùng nội dung dữ liệu mẫu cũ |
| `FISG_STORE.canWrite()` | App có đang ở trạng thái ghi được không |
| `LS.pendingActs()` | Hoạt động đã nhập nhưng chưa lên SharePoint |
| `FISG_STORE.pushPendingActs()` | Đẩy ngay số hoạt động còn kẹt |
| `FISG_STORE.pushPendingDone()` | Đẩy ngay trạng thái hoàn thành còn kẹt trong máy |
| `FISG_STORE.forgetSchema()` | Đọc lại sơ đồ cột sau khi vừa thêm cột trên SharePoint |
| `LISTS` | Toàn bộ danh mục app đang dùng |
| `USERS` | Danh sách người dùng đọc được từ list Users |
| `RECORDS.length`, `ACTIVITIES.length` | Số bản ghi đã tải |

Nếu tên cột trên SharePoint khác với tên app đang tìm, chạy `FISG_STORE.debug()` rồi gửi kết quả — sửa bảng ánh xạ trong `js/store.js` là xong.

## 5. Điều tôi chưa kiểm chứng được

Tôi không kết nối được vào SharePoint của bạn, nên:

- Tên cột của list `Pipelines` ở mục 1.2 là **suy đoán**. Nếu khác, app dùng quy trình trong `js/data/catalog.js` — vẫn đúng, chỉ là không sửa được từ SharePoint.
- Toàn bộ kiểm thử chạy trên dữ liệu giả lập đúng hình dạng mà `store.js` đang map, không phải dữ liệu thật của bạn.

Lần đầu chạy thật, nhiều khả năng phải chỉnh lại vài tên cột. Đó là việc năm phút, không phải làm lại.
