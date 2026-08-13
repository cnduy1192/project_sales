(function () {
  "use strict";

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

  function stripDiacritics(s) {
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D");
  }

  var PREFIX_NORM = PREFIXES.map(function (p) {
    return { raw: p, norm: stripDiacritics(p).toUpperCase() };
  });

  function stripOnePrefix(name) {
    var trimmed = name.replace(/^[\s\-–—:.,;()]+/, "");
    var normHead = stripDiacritics(trimmed).toUpperCase();
    for (var i = 0; i < PREFIX_NORM.length; i++) {
      var p = PREFIX_NORM[i].norm;

      if (normHead.indexOf(p) === 0) {
        var after = normHead.charAt(p.length);
        if (after === "" || /[\s\-–—:.,;()]/.test(after)) {
          return trimmed.slice(p.length);
        }
      }
    }
    return null;
  }

  function cleanCustomerName(raw) {
    var s = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
    if (!s) return "";
    var cur = s, step;
    for (var guard = 0; guard < 6; guard++) {
      step = stripOnePrefix(cur);
      if (step == null) break;
      step = step.replace(/^[\s\-–—:.,;()]+/, "").replace(/\s+/g, " ").trim();
      if (!step) break;
      cur = step;
    }
    return cur || s;
  }

  function custOwnerKey(raw) {
    return stripDiacritics(cleanCustomerName(raw)).toUpperCase().replace(/\s+/g, " ").trim();
  }

  window.cleanCustomerName = cleanCustomerName;
  window.custOwnerKey = custOwnerKey;
  window.FISG_CLEANNAME = { cleanCustomerName: cleanCustomerName, custOwnerKey: custOwnerKey,
                            stripDiacritics: stripDiacritics };
})();
