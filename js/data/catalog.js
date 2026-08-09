/* js/data/catalog.js — DANH MỤC NGHIỆP VỤ.

   Đây KHÔNG phải dữ liệu demo. Quy trình bán hàng của từng nhà cung cấp, cách
   xếp nhóm giai đoạn, % mặc định và cây phân khúc thị trường là CẤU HÌNH: chúng
   mô tả cách FI Saigon làm việc, hiếm khi đổi, và không nên phụ thuộc vào việc
   có tồn tại một list trên SharePoint hay không.

   (Trước đây khối này nằm lẫn trong demo-data.js nên bị xoá cùng dữ liệu demo.
   Tách ra để lần sau không mất nữa.)

   Thứ tự ưu tiên khi app chạy:
     1. List `Pipelines` trên SharePoint — nếu đọc được thì THAY THẾ phần dưới
     2. Bảng dưới đây — mặc định
     3. Giai đoạn lạ xuất hiện trong dữ liệu mà cả hai nguồn trên không biết
        → tự thêm vào cuối, để không dự án nào bị mất khỏi funnel

   Quy tắc sửa tại chỗ: js/config.js giữ THAM CHIẾU tới các object bên trong
   LISTS, nên mọi cập nhật phải dùng length = 0 rồi push, hoặc xoá từng khoá —
   tuyệt đối không gán lại LISTS.pipelines = {…}. */

/* ---------- CẤU HÌNH GỐC ---------- */
var CATALOG = {
  /* Nhà cung cấp. Nhà cung cấp mới xuất hiện trong dữ liệu SharePoint sẽ được
     bổ sung thêm, không thay thế danh sách này. */
  nccs: ["Roquette", "IFF", "Kimica-Navido"],

  /* Quy trình bán hàng của từng NCC, ĐÚNG THỨ TỰ. Thứ tự này quyết định dải
     "Phân bố giai đoạn" trên Sales Funnel và ô chọn giai đoạn trong form. */
  pipelines: {
    "Roquette":      ["SHARED BUSINESS GOAL", "BUILDING A SOLUTION", "SOLUTION TESTING", "OFFER & AGREEMENT"],
    "IFF":           ["LEAD", "SAMPLE SENT", "TESTING", "TEST PASSED", "QUOTED / PO"],
    "Kimica-Navido": ["LEAD", "SAMPLE SENT", "TESTING", "TEST PASSED", "QUOTED / PO", "POSTPONED"]
  },

  /* Nhóm giai đoạn — lớp duy nhất so sánh được giữa ba NCC, vì Roquette gọi
     "SOLUTION TESTING" còn IFF gọi "TESTING". Cockpit dựa hoàn toàn vào đây. */
  groupOf: {
    "SHARED BUSINESS GOAL": "Tiếp cận",
    "LEAD":                 "Tiếp cận",
    "BUILDING A SOLUTION":  "Thử mẫu",
    "SOLUTION TESTING":     "Thử mẫu",
    "SAMPLE SENT":          "Thử mẫu",
    "TESTING":              "Thử mẫu",
    "TEST PASSED":          "Thử mẫu",
    "OFFER & AGREEMENT":    "Đàm phán",
    "QUOTED / PO":          "Đàm phán",
    "POSTPONED":            "Hoãn"
  },

  /* % thắng mặc định khi chọn giai đoạn. Sales sửa tay được trên từng dự án. */
  probOf: {
    "SHARED BUSINESS GOAL": 10,
    "BUILDING A SOLUTION":  25,
    "SOLUTION TESTING":     50,
    "OFFER & AGREEMENT":    75,
    "LEAD":                 10,
    "SAMPLE SENT":          25,
    "TESTING":              40,
    "TEST PASSED":          60,
    "QUOTED / PO":          80,
    "POSTPONED":            15
  },

  /* Cây phân khúc thị trường: nhóm ngành → segment. */
  segTree: {
    "BAKERY":  ["BAKERY", "CONFECTIONARY", "SNACK"],
    "SAVOURY": ["FAT & OIL", "MEAT", "NOODLES", "PROCESSED FOOD", "SAUCE & SEASONING", "SEAFOOD", "VEGAN"],
    "SWEET":   ["BEVERAGE", "DAIRY", "SWEET FOOD"]
  },

  segments: ["BAKERY", "BEVERAGE", "CONFECTIONARY", "DAIRY", "FAT & OIL", "MEAT",
             "NOODLES", "PROCESSED FOOD", "SAUCE & SEASONING", "SEAFOOD", "SNACK",
             "SWEET FOOD", "VEGAN"]
};

/* ---------- DANH MỤC ĐANG DÙNG ----------
   Khởi tạo từ CATALOG. store.js bổ sung phần suy từ dữ liệu thật (khách hàng,
   sản phẩm, ứng dụng, sales) và ghi đè pipeline nếu đọc được list Pipelines. */
/* Nhà cung cấp "Khác": hoạt động không gắn với NCC nào — hội thảo chung, khách
   mới chưa rõ sẽ chào hàng của ai. Không phải một NCC thật, nên KHÔNG nằm trong
   CATALOG.nccs (không tạo tab, không có pipeline riêng). */
var OTHER_NCC = 'Khác';

var LISTS = {
  nccs:      CATALOG.nccs.slice(),
  pipelines: JSON.parse(JSON.stringify(CATALOG.pipelines)),
  groupOf:   Object.assign({}, CATALOG.groupOf),
  probOf:    Object.assign({}, CATALOG.probOf),
  segTree:   JSON.parse(JSON.stringify(CATALOG.segTree)),
  segments:  CATALOG.segments.slice(),

  /* Bốn danh mục dưới đây thuần tuý suy từ dữ liệu — rỗng cho tới khi tải xong. */
  customers:    [],
  products:     [],
  applications: [],
  pics:         []
};

/* Đưa LISTS về đúng cấu hình gốc, sửa TẠI CHỖ để giữ tham chiếu của config.js. */
function resetCatalog() {
  LISTS.nccs.length = 0;      CATALOG.nccs.forEach(function (n) { LISTS.nccs.push(n); });
  LISTS.segments.length = 0;  CATALOG.segments.forEach(function (s) { LISTS.segments.push(s); });
  [["pipelines", "segTree"], ["groupOf", "probOf"]];
  ["pipelines", "segTree"].forEach(function (k) {
    Object.keys(LISTS[k]).forEach(function (x) { delete LISTS[k][x]; });
    Object.keys(CATALOG[k]).forEach(function (x) { LISTS[k][x] = CATALOG[k][x].slice(); });
  });
  ["groupOf", "probOf"].forEach(function (k) {
    Object.keys(LISTS[k]).forEach(function (x) { delete LISTS[k][x]; });
    Object.assign(LISTS[k], CATALOG[k]);
  });
}
window.resetCatalog = resetCatalog;

/* Dữ liệu nghiệp vụ — rỗng cho tới khi đăng nhập và tải từ SharePoint. */
var RECORDS = [];
var ACTIVITIES = [];

/* Danh bạ khách hàng đọc từ list Customers: mỗi phần tử {name, owner, legal,
   spId}. Kèm hai bảng tra theo custOwnerKey để phân quyền và hiển thị tra nhanh.
   store.js đổ đầy sau khi đăng nhập; giữ THAM CHIẾU nên chỉ sửa tại chỗ. */
var CUSTOMER_DIR = [];
var CUSTOMER_OWNER = {};   // custOwnerKey → tên chủ sở hữu
var CUSTOMER_LEGAL = {};   // custOwnerKey → tên pháp nhân đầy đủ

/* Báo cáo tuần đã GỬI (đọc từ list Reports) kèm luồng phản hồi (ReportComments).
   Mỗi phần tử: {id, spId, pic, picLabel, weekLabel, createdAt, note, stats,
   doneActs, missedActs, projectChanges, to, comments:[{by,role,at,text}]}.
   Bản nháp CHƯA gửi vẫn ở localStorage — chỉ khi bấm gửi mới lên SharePoint. */
var REPORTS = [];
