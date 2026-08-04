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
