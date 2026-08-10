# Đính kèm file cho hoạt động khách hàng & báo cáo tuần

Ngày: 2026-08-05

## Mục tiêu
Cho phép đính kèm file (pdf, word, excel, ppt, ảnh, zip) vào (1) từng hoạt động
khách hàng và (2) báo cáo tuần. File lưu trong SharePoint Document Library theo
một cây thư mục cố định; metadata trong một list `Attachments`.

## Quyết định đã chốt
- Đính kèm ở **cả** hoạt động lẫn báo cáo.
- Cây thư mục trong thư viện tài liệu mặc định của site:
  - Hoạt động: `FISG_Attachments / <PIC> / <YYYY-MM-DD> / <Khách hàng> / <file>`
  - Báo cáo:   `FISG_Attachments / <PIC> / <YYYY-MM-DD> / Báo cáo / <file>`
- Phương án A: file trong Document Library + list `Attachments` giữ metadata và
  liên kết đúng file ↔ hoạt động/báo cáo (folder gộp nhiều hoạt động nên riêng
  folder không đủ để phân biệt).
- Quyền xoá: người tải lên HOẶC quản lý/admin.
- Giới hạn: ≤ 15MB; loại: pdf, doc, docx, xls, xlsx, ppt, pptx, jpg, jpeg, png, zip.
- Không cần scope mới: `Sites.ReadWrite.All` đã đủ tải lên/xoá file trong site.

## Kiến trúc

### 1. Graph — `js/graph.js`
- `ensureFolder(path)`: tạo dần từng cấp thư mục trong drive mặc định (idempotent,
  bỏ qua 409 đã tồn tại).
- `uploadFile(folderPath, fileName, blob)`: ≤4MB dùng PUT `.../content`; >4MB dùng
  upload session (POST createUploadSession rồi PUT theo mảnh). Trả về driveItem
  `{id, webUrl, name, size}`.
- `deleteDriveItem(itemId)`.
- Tên PIC / khách hàng làm sạch ký tự cấm (`\ / : * ? " < > | # %`), gom khoảng
  trắng. Tên file thêm hậu tố giờ `-HHmmss` trước phần mở rộng để không đè nhau.

### 2. List `Attachments` (mới) — cột
| Cột | Kiểu |
|---|---|
| Title | file name |
| ParentType | text: `activity` \| `report` |
| ParentId | text: spId hoạt động / mã báo cáo |
| FileName, FileType, Size | text / number |
| WebUrl | text (link xem/tải) |
| DriveItemId | text (để xoá) |
| FolderPath | text |
| PICName | text (người tải) |
| UploadDate | Date |

### 3. Store — `js/store.js`
- `ATTACHMENTS[]` global; `loadAttachments()` nạp khi sync, index theo
  `ParentType:ParentId`. `attachmentsOf(type, id)`.
- `uploadAttachment(parentType, parentId, ctx, file)`:
  kiểm loại + kích thước → ensureFolder(path từ ctx {pic, date, customer|report})
  → uploadFile → tạo dòng Attachments → refresh. Báo lỗi rõ, không nuốt.
- `deleteAttachment(att)`: xoá driveItem + xoá dòng list; cập nhật ATTACHMENTS.
- LABELS.Attachments; `ATT_MAX = 15*1024*1024`; `ATT_TYPES` allowlist.

### 4. Giao diện
- **Hoạt động**: form sửa một hoạt động ĐÃ LƯU (có spId) thêm khu "Tệp đính kèm":
  danh sách file (tên, kích thước, nút tải/xoá theo quyền) + ô chọn file. Hoạt
  động mới phải lưu trước rồi mới đính kèm.
- **Báo cáo**: panel báo cáo (rpRenderPanel) thêm khu "Tệp đính kèm" tương tự.
- Trạng thái tải: thanh tiến độ / spinner; disable nút khi đang tải.

### 5. Quyền
- Tải lên: hoạt động → chủ hoạt động (canEditAct); báo cáo → chủ báo cáo + quản lý
  (rpCanComment).
- Xoá: `attCanDelete(att)` = người tải (isMine) HOẶC quản lý/admin.
- Xem/tải: ai thấy được hoạt động/báo cáo (đã theo bộ lọc quyền sẵn có).

### 6. Kiểm thử — `tests/smoke.js`
Mock Graph (ensureFolder/uploadFile/deleteDriveItem). Ca:
- upload tạo đúng dòng Attachments (ParentType/Id, FolderPath, WebUrl).
- chặn file quá 15MB và loại ngoài allowlist (không gọi upload).
- attachmentsOf trả đúng file theo hoạt động/báo cáo.
- xoá gỡ cả driveItem lẫn dòng list; quyền xoá đúng người.
- i18n-scan phủ chuỗi mới.

## Ngoài phạm vi
Không xem trước (preview) file trong app — chỉ link mở trên SharePoint. Không
version file. Không kéo-thả nhiều file cùng lúc (chọn từng file; có thể mở rộng
sau).
