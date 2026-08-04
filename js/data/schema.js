/* js/data/schema.js — bộ khung danh mục RỖNG, thay cho demo-data.js đã bỏ.
   Toàn bộ nội dung do js/store.js đổ vào từ SharePoint sau khi đăng nhập.

   Vì sao vẫn cần file này: js/config.js đọc LISTS.pics, LISTS.pipelines… ngay lúc
   nạp và giữ THAM CHIẾU tới các mảng/object đó. Nên mọi chỗ cập nhật phải sửa
   TẠI CHỖ (length = 0 rồi push), tuyệt đối không gán lại LISTS.pics = [...],
   nếu không các hằng dẫn xuất trong config.js sẽ trỏ vào mảng cũ. */

var LISTS = {
  nccs: [],           // ['Roquette', 'IFF', …] — nhà cung cấp
  pipelines: {},      // { 'Roquette': ['SHARED BUSINESS GOAL', …] } — giai đoạn theo NCC, đúng thứ tự
  groupOf: {},        // { 'SOLUTION TESTING': 'Thử mẫu' } — nhóm giai đoạn, để so sánh giữa các NCC
  probOf: {},         // { 'SOLUTION TESTING': 50 } — % mặc định của giai đoạn
  segTree: {},        // { 'BAKERY': ['BAKERY','CONFECTIONARY',…] } — nhóm ngành → segment
  segments: [],       // danh sách segment phẳng
  customers: [],      // gợi ý cho ô nhập khách hàng
  products: [],       // gợi ý cho ô nhập sản phẩm
  applications: [],   // gợi ý cho ô nhập ứng dụng
  pics: []            // tên sales, dùng cho ô "người liên quan"
};

/* Dữ liệu nghiệp vụ. store.js thay nội dung tại chỗ sau khi tải SharePoint. */
var RECORDS = [];
var ACTIVITIES = [];
