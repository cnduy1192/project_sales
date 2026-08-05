# Kiểm thử khói

```bash
cd tests
npm install
npm test
```

Nạp `index.html` thật cùng toàn bộ script vào jsdom, giả lập Microsoft Graph và
localStorage, rồi đi qua những đường dễ vỡ nhất: phân quyền năm vai trò, đổi tên
PIC, danh mục cấu hình, khối cập nhật hoạt động giữa tuần, và các màn hình chính.

Không cần mạng, không cần SharePoint. Chạy hết trong vài giây.

Hai cảnh báo của jsdom có thể bỏ qua: `getContext()` (không có canvas) và
`createLinearGradient` (Chart.js vẽ hụt) — chúng không phải lỗi của app.


## Máy dò song ngữ

```bash
cd tests
node i18n-scan.js
```

Nạp app trong jsdom ở chế độ EN, đi qua mọi màn hình và popup, rồi liệt kê mọi
chuỗi CÒN DẤU TIẾNG VIỆT kèm nơi xuất hiện. Thoát mã 1 nếu còn sót.

Dữ liệu mẫu trong máy dò cố tình viết không dấu, nên mọi thứ nó tìm thấy đều
chắc chắn là chữ của giao diện chứ không phải của người dùng nhập.

Cách sửa: thêm câu vào `DICT` trong `js/i18n.js`. Chỉ dùng `RULES` (regex) cho
chuỗi có nội suy số/ngày/tên — regex cắt giữa câu là nguồn gốc của những lỗi
kiểu "Dự án đã closed".
