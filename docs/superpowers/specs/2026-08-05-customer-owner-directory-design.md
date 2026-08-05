# Danh bạ khách hàng theo chủ sở hữu + làm gọn tên

Ngày: 2026-08-05
Nguồn: `Customer_Data.xlsx` — 388 khách hàng × chủ sở hữu, 10 sales.

## Mục tiêu

1. Mỗi khách hàng thuộc về một sales. Sales không thấy khách hàng của nhau.
2. Gắn (map) dữ liệu chủ sở hữu này vào dữ liệu dự án/hoạt động đang có.
3. Làm gọn tên khách hàng (bỏ "Công ty TNHH/Cổ phần", "Hộ kinh doanh", "Chi
   nhánh", "Văn phòng đại diện"…).

## Quyết định đã chốt

- **Phân quyền cộng thêm.** Sales thấy dự án/hoạt động nếu mình là PIC, HOẶC là
  chủ sở hữu khách hàng, HOẶC là người liên quan. Chủ sở hữu chỉ mở rộng phạm
  vi, không gỡ quyền của ai.
- **Tên gọn lưu ở Title, giữ tên gốc.** List `Customers`: `Title` = tên gọn,
  thêm cột `LegalName` = tên pháp nhân đầy đủ, `Owner` = tên PIC người phụ trách.
- **Nhập cả 388 KH thành danh bạ** + màn hình "Khách hàng của tôi".
- **KH không có trong file** (chưa gán chủ) giữ nguyên phân quyền theo PIC dự án.
- **Hướng A:** tôi tạo sẵn file Excel đã làm gọn để bạn import một lần vào list
  `Customers`; app chỉ đọc thêm hai cột. Không có lệnh ghi hàng loạt tự động.

## Kiến trúc

### 1. Làm gọn tên — `js/lib/cleanname.js`
`cleanCustomerName(raw)` bỏ tiền tố pháp nhân, chạy lặp để xử lý tiền tố lồng
nhau ("Chi nhánh Công ty Cổ phần …"), gom khoảng trắng. `custOwnerKey(raw)` =
cleanCustomerName rồi bỏ dấu + hoa hết, dùng làm khoá đối chiếu.
Đã thử trên 388 dòng: 386 tên riêng, 0 dòng rỗng, 0 khách bị hai sales sở hữu.
Dùng ở hai nơi: (a) lúc sinh file import, (b) trong app như lớp phòng hờ khi
hiển thị — tên còn tiền tố vẫn hiện gọn.

### 2. Đọc dữ liệu — `js/store.js`
Đọc thêm `Owner`, `LegalName` từ list Customers (tự dò internal name như các cột
khác). Dựng hai bảng: `CUSTOMER_OWNER` (custOwnerKey → tên chủ), `CUSTOMER_LEGAL`
(custOwnerKey → tên pháp nhân). Hàm toàn cục `customerOwnerOf(name)`.

### 3. Phân quyền — `js/lib/roles.js`
`ownsRecord` thêm nhánh: `|| isMine(customerOwnerOf(r.customer), u)`.
`ownsActivity` tương tự cho `a.customer`. Ghép bằng HOẶC, giữ nguyên luật cũ.
Khách không có chủ → `customerOwnerOf` trả '' → nhánh không kích hoạt.

### 4. Màn hình "Khách hàng của tôi" — `js/views/customers.js`
View mới trong menu Làm việc. Bảng danh bạ lọc theo chủ sở hữu (sales: của mình;
manager/director/admin: cả đội, lọc theo từng sales). Mỗi dòng: tên gọn, tên
pháp nhân (mờ), NCC/segment nếu suy được, số dự án đang chạy, hoạt động gần nhất,
nút tạo dự án / ghi hoạt động nhanh (prefill khách hàng). Khách chưa có dự án vẫn
hiện — đó là điểm chính.

### 5. Tạo KH mới trong app
`saveForm`/`saveAct`: khách hàng gõ tay mới mặc định gán `Owner` = sales đang
đăng nhập khi ghi lên list Customers.

### 6. File import — deliverable
Script Python đọc `Customer_Data.xlsx`, xuất `Customers_Import.xlsx`:
cột `Tên gọn (Title)`, `Tên pháp nhân (LegalName)`, `Chủ sở hữu (Owner)`, và cột
`Tên gốc` để bạn đối chiếu trước khi import.

## Kiểm thử
`tests/smoke.js`: hàm làm gọn (tiền tố lồng nhau, không rỗng), phân quyền cộng
thêm (sales thấy dự án của khách mình sở hữu dù PIC khác; không thấy khách của
sales khác), màn hình danh bạ lọc đúng chủ. Script kiểm tra file import khớp 388
dòng, 0 khách hai chủ.

## Ngoài phạm vi
Không tự merge khách trùng tên (đã có `findDuplicateCustomers`). Không đổi luồng
chia sẻ. Không ghi hàng loạt tự động lên SharePoint.
