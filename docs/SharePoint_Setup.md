# Chuyển sang chạy hoàn toàn trên SharePoint

Ngày: 04/08/2026

Dữ liệu demo đã bị gỡ bỏ. `js/data/demo-data.js` (493 KB) đã xoá; bốn tài khoản demo trong `config.js` cũng đã bỏ.

Thay vào đó là `js/data/catalog.js`, chỉ giữ phần **cấu hình nghiệp vụ**: quy trình bán hàng của từng nhà cung cấp, nhóm giai đoạn, % mặc định, cây phân khúc thị trường. Đây không phải dữ liệu demo — chúng mô tả cách FI Saigon làm việc, hiếm khi đổi, và không nên phụ thuộc vào việc có tồn tại list nào trên SharePoint hay không.

Từ giờ **không đăng nhập Microsoft 365 thì không có dữ liệu nào**. Đây là hành vi đúng, không phải lỗi.

## 1. Việc bạn cần làm trên SharePoint

### 1.1 Tạo list `Users` — bắt buộc

Không có list này thì không ai được gán vai trò sales, và toàn bộ phần cá nhân hoá (Tổng quan tuần, phạm vi xem của sales, gợi ý việc) không hoạt động.

Site: `fisaigonvn.sharepoint.com/sites/SalesProjectTracker` → **New → List** → đặt tên `Users`.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `Title` | Single line of text | có | Email đăng nhập M365. Ví dụ `thu@fisaigon.vn` |
| `Email` | Single line of text | không | Dùng khi không muốn để email ở cột Title |
| `Role` | Choice | có | Ba giá trị: `sales`, `manager`, `superadmin` |
| `PICName` | Single line of text | **không** | Đường lui, xem bên dưới. Để trống là bình thường |

Ví dụ nội dung — phần lớn dòng chỉ cần hai cột:

| Title | Role | PICName |
|---|---|---|
| duy.chengoc@fisaigon.vn | superadmin | |
| manager@fisaigon.vn | manager | |
| thu@fisaigon.vn | sales | |
| ngoc.phambich@fisaigon.vn | sales | Bich Ngoc |

### PIC lấy từ đâu

**Mặc định, PIC chính là tên hiển thị O365 của người đăng nhập.** Cột PIC trong list Projects là trường Person, SharePoint trả về đúng tên đầy đủ ấy — nên hai bên tự khớp, không phải khai gì.

Cột `PICName` chỉ dùng khi tên O365 **khác** giá trị PIC trong dữ liệu: người đổi tên, hoặc dữ liệu cũ còn ghi tên viết tắt (`Bich Ngoc` thay vì `Phạm Bích Ngọc`). Khi có giá trị, `PICName` thắng; tên hiển thị trên giao diện vẫn là tên O365.

App tự kiểm tra sau mỗi lần tải: nếu tên O365 của bạn không khớp giá trị PIC nào trong dữ liệu, nó báo ngay trên màn hình kèm các tên gần đúng, thay vì để bạn ngồi nhìn một danh sách dự án trống mà không hiểu vì sao. Muốn xem chi tiết thì gõ trong Console:

```js
picMatchReport(me.pic)
```

Nếu chưa kịp tạo list, app **không khoá cửa**: `ADMIN_EMAIL` trong `sp-config.js` vào với quyền superadmin, người khác vào với quyền manager, kèm cảnh báo trên màn hình.

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

## 4. Chẩn đoán khi có trục trặc

Trong Console sau khi đăng nhập:

| Lệnh | Cho biết |
|---|---|
| `FISG_STORE.debug()` | Tên cột thật của list Projects và một bản ghi mẫu |
| `picMatchReport(me.pic)` | Tên O365 của bạn có khớp cột PIC trong dữ liệu không |
| `FISG_STORE.findDuplicateCustomers()` | Nhóm khách hàng nghi trùng tên |
| `LISTS` | Toàn bộ danh mục app đang dùng |
| `USERS` | Danh sách người dùng đọc được từ list Users |
| `RECORDS.length`, `ACTIVITIES.length` | Số bản ghi đã tải |

Nếu tên cột trên SharePoint khác với tên app đang tìm, chạy `FISG_STORE.debug()` rồi gửi kết quả — sửa bảng ánh xạ trong `js/store.js` là xong.

## 5. Điều tôi chưa kiểm chứng được

Tôi không kết nối được vào SharePoint của bạn, nên:

- Tên cột của list `Pipelines` ở mục 1.2 là **suy đoán**. Nếu khác, app dùng quy trình trong `js/data/catalog.js` — vẫn đúng, chỉ là không sửa được từ SharePoint.
- Toàn bộ kiểm thử chạy trên dữ liệu giả lập đúng hình dạng mà `store.js` đang map, không phải dữ liệu thật của bạn.

Lần đầu chạy thật, nhiều khả năng phải chỉnh lại vài tên cột. Đó là việc năm phút, không phải làm lại.
