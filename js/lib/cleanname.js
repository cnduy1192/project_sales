/* js/lib/cleanname.js — làm gọn tên khách hàng (classic script, scope toàn cục).
 *
 * Bỏ các tiền tố pháp nhân ("Công ty TNHH", "Cổ phần", "Hộ kinh doanh", "Chi
 * nhánh", "Văn phòng đại diện"…) để tên hiển thị ngắn gọn, dễ đọc trên bảng.
 *
 * Dùng ở HAI nơi và phải cho KẾT QUẢ GIỐNG NHAU:
 *   1. Lúc sinh file import (script Python cùng thuật toán) — tên gọn ghi vào
 *      cột Title của list Customers.
 *   2. Trong app như lớp phòng hờ: nếu một tên trên SharePoint vẫn còn tiền tố
 *      (nhập tay, chưa qua file import), app vẫn hiển thị gọn.
 *
 * KHÔNG đụng tới dữ liệu gốc: đây thuần là hàm biến đổi chuỗi, không ghi gì. */
(function () {
  "use strict";

  /* Các tiền tố pháp nhân, DÀI trước NGẮN (nếu không "CÔNG TY" nuốt mất phần
     "CỔ PHẦN" đứng sau rồi để lại rác). So khớp không phân biệt hoa thường và
     dấu, nhưng CẮT trên chuỗi gốc để giữ nguyên chữ hoa/thường của tên thật. */
  var PREFIXES = [
    "VĂN PHÒNG ĐẠI DIỆN", "VPĐD",
    "CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI DỊCH VỤ",
    "CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ",
    "CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI",
    "CÔNG TY TNHH THƯƠNG MẠI",
    "CÔNG TY TNHH SẢN XUẤT",
    "CÔNG TY TNHH MỘT THÀNH VIÊN",
    "CÔNG TY TNHH MTV",
    "CÔNG TY CỔ PHẦN SẢN XUẤT THƯƠNG MẠI",
    "CÔNG TY CỔ PHẦN THƯƠNG MẠI",
    "CÔNG TY CỔ PHẦN TẬP ĐOÀN",
    "CÔNG TY CỔ PHẦN",
    "CÔNG TY TNHH",
    "CÔNG TY CP",
    "CÔNG TY",
    "CTY TNHH", "CTY CP", "CTY",
    "TỔNG CÔNG TY",
    "DOANH NGHIỆP TƯ NHÂN", "DNTN",
    "HỘ KINH DOANH", "HKD",
    "CHI NHÁNH",
    "NHÀ MÁY",
    "CƠ SỞ SẢN XUẤT", "CƠ SỞ",
    "XÍ NGHIỆP",
    "HỢP TÁC XÃ", "HTX",
    "TNHH MTV", "TNHH", "MTV", "CP"
  ];

  /* Bỏ dấu tiếng Việt để so khớp tiền tố — "CÔNG TY" và "CONG TY" như nhau. */
  function stripDiacritics(s) {
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D");
  }

  var PREFIX_NORM = PREFIXES.map(function (p) {
    return { raw: p, norm: stripDiacritics(p).toUpperCase() };
  });

  /* Cắt MỘT tiền tố ở đầu (nếu có). Trả về null nếu không cắt được gì. */
  function stripOnePrefix(name) {
    var trimmed = name.replace(/^[\s\-–—:.,;()]+/, "");
    var normHead = stripDiacritics(trimmed).toUpperCase();
    for (var i = 0; i < PREFIX_NORM.length; i++) {
      var p = PREFIX_NORM[i].norm;
      /* Tiền tố phải đứng ở đầu VÀ theo sau bởi ranh giới từ (dấu cách/gạch/hết
         chuỗi) — nếu không "CP" sẽ nuốt nhầm "CPFOODS". */
      if (normHead.indexOf(p) === 0) {
        var after = normHead.charAt(p.length);
        if (after === "" || /[\s\-–—:.,;()]/.test(after)) {
          return trimmed.slice(p.length);
        }
      }
    }
    return null;
  }

  /* Tên gọn để HIỂN THỊ. Lặp để xử lý tiền tố lồng nhau như
     "Chi nhánh Công ty Cổ phần …". Nếu bỏ hết mà rỗng thì trả lại tên gốc đã
     gom khoảng trắng — thà dài còn hơn trống. */
  function cleanCustomerName(raw) {
    var s = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
    if (!s) return "";
    var cur = s, step;
    for (var guard = 0; guard < 6; guard++) {
      step = stripOnePrefix(cur);
      if (step == null) break;
      step = step.replace(/^[\s\-–—:.,;()]+/, "").replace(/\s+/g, " ").trim();
      if (!step) break;                 // bỏ nữa là rỗng → giữ bước trước
      cur = step;
    }
    return cur || s;
  }

  /* Khoá đối chiếu: tên gọn, bỏ dấu, hoa hết, gom khoảng trắng. Hai tên khác
     cách viết hoa/dấu nhưng cùng một khách sẽ ra cùng khoá. Dùng để tra chủ sở
     hữu và để ghép dữ liệu file với dự án đang có. */
  function custOwnerKey(raw) {
    return stripDiacritics(cleanCustomerName(raw)).toUpperCase().replace(/\s+/g, " ").trim();
  }

  window.cleanCustomerName = cleanCustomerName;
  window.custOwnerKey = custOwnerKey;
  window.FISG_CLEANNAME = { cleanCustomerName: cleanCustomerName, custOwnerKey: custOwnerKey,
                            stripDiacritics: stripDiacritics };
})();
