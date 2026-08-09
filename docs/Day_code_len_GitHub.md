# Đẩy code lên GitHub bằng GitHub Desktop

Thư mục `web` đã là một repo git thật, trỏ sẵn về `github.com/cnduy1192/project_sales`, và bản sửa mới nhất **đã được commit sẵn**. Việc còn lại chỉ là đẩy lên.

## Lần đầu — làm một lần duy nhất

1. Tải **GitHub Desktop** tại `desktop.github.com`, cài rồi mở.
2. `File → Options → Accounts → Sign in to GitHub.com`, đăng nhập tài khoản `cnduy1192`.
3. `File → Add local repository…`, chọn đúng thư mục:

   ```
   D:\Duy\Claude-Work\Projects\Project Sale_FISG\web
   ```

   GitHub Desktop tự nhận ra đây là repo và đã có remote — không cần khai gì thêm.
4. Góc trên bên phải hiện **Push origin** kèm số commit đang chờ. Bấm vào đó.

Xong. GitHub Pages sẽ tự dựng lại sau một hai phút.

## Những lần sau

Mỗi khi tôi báo đã sửa xong:

1. Mở GitHub Desktop.
2. Nhìn tab **Changes** để soát lại thay đổi nếu muốn.
3. Nếu tôi đã commit sẵn: bấm **Push origin**.
   Nếu còn thay đổi chưa commit: gõ một dòng mô tả ở ô dưới bên trái, bấm **Commit to main**, rồi **Push origin**.

## Thay đổi đang chờ commit + đẩy

Lần này tôi **không commit hộ được** vì `.git` đang bị khoá từ phía Windows
(`.git/index.lock` — thường do GitHub Desktop đang mở, hoặc một tiến trình git
trước đó chưa đóng). Sandbox không xoá được file khoá đó. Toàn bộ mã nguồn đã
sửa xong và lưu đúng trong thư mục `web`.

**Các bước:**

1. Nếu GitHub Desktop đang mở, đóng và mở lại — nó tự dọn `index.lock`.
   Nếu vẫn báo khoá: xoá tay file `web\.git\index.lock` trong File Explorer.
2. Mở GitHub Desktop, tab **Changes**, gõ mô tả (gợi ý bên dưới),
   bấm **Commit to main**, rồi **Push origin**.

```
Form Kế hoạch làm việc + Tạo hoạt động; hộp thoại về giữa màn; supplier dropdown; khách hàng báo chủ quản lý
```

**Nội dung thay đổi:**

- Mọi hộp thoại (Kế hoạch làm việc, Thêm dự án, Chi tiết, Đóng dự án, Thêm NCC)
  **hiển thị ở giữa màn hình**, cao tối đa 92% khung nhìn, tự cuộn phần thân.
- Form tạo hoạt động: tiêu đề **"Kế hoạch làm việc"**; nút/menu tạo là **"Tạo
  hoạt động"**. Loại hoạt động Call/Visit/Email/Exhibition; "Interest level"
  High/Medium/Low; "Purpose / Objective"; "Action". Dữ liệu cũ Hot/Warm/Cold và
  Seminar tự ánh xạ sang nhãn mới.
- Khách hàng: danh sách xổ xuống **toàn bộ khách của phần mềm** (thấy cả khách
  của sales khác); chọn xong hiện dòng **khách này do ai quản lý**.
- Nhà cung cấp: **dropdown đầy đủ các NCC + lựa chọn "Khác"**.
- Lịch tuần: **bấm một ngày** hiện menu tạo nhanh hoạt động hoặc dự án cho ngày đó.

Ba commit "Add files via upload" cũ vẫn còn nguyên trong lịch sử, không mất gì.

## Sau khi đẩy, kiểm tra nhanh

Mở `https://cnduy1192.github.io/project_sales/` rồi:

1. Màn hình đăng nhập chỉ còn hai nút: **Microsoft 365** và **Guest**. Không còn khối chọn vai trò demo.
2. Đăng nhập Microsoft. Nếu chưa tạo list `Users` trên SharePoint, app vẫn cho vào và báo rõ — xem `docs/SharePoint_Setup.md`.
3. Mở Console (F12) gõ `RECORDS.length` — phải ra số dự án thật từ SharePoint, không phải 574 của dữ liệu demo cũ.

Nếu trang trắng hoặc lỗi, F12 → tab Console, chụp lại thông báo lỗi gửi tôi.

## Khi nào cần lệnh git

GitHub Desktop lo được gần hết. Chỉ hai tình huống cần terminal:

**Ai đó sửa file thẳng trên GitHub web** trong lúc bạn cũng sửa ở máy → GitHub Desktop sẽ báo xung đột và hướng dẫn từng bước. Cứ làm theo.

**Muốn quay lại bản trước khi đẩy** → trong GitHub Desktop, chuột phải vào commit trong tab History, chọn `Undo commit`. Chỉ làm được khi chưa Push.
