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

## Commit đang chờ đẩy

```
6a90c88  Bỏ dữ liệu demo, chạy trên SharePoint; thêm Cockpit và màn hình tuần của sales
```

31 file thay đổi · 3.686 dòng thêm · 162 dòng xoá.

Điểm cần biết: commit này **xoá** `js/data/demo-data.js` khỏi repo. Đó chính là thứ mà cách kéo thả file qua giao diện web GitHub không làm được — file cũ vẫn nằm lại trên đó mãi. Đẩy bằng git thì việc xoá được ghi nhận đúng.

Ba commit "Add files via upload" trước đây vẫn còn nguyên trong lịch sử, không mất gì.

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
