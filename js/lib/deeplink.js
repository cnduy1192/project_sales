/* ============================================================
   Deep-link cho tracker: index.html?open=acts&q=<khách hàng>
   Dùng khi mở một hoạt động từ trang Sales Funnel (salesfunnel.html).
   Sau khi đăng nhập & tải xong dữ liệu, tự mở view Hoạt động và lọc.
   ============================================================ */
(function () {
  "use strict";
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { return; }
  var open = params.get("open");
  if (!open) return;
  var q = params.get("q") || "";

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    var ready = (typeof me !== "undefined" && me && typeof window.go === "function");
    if (ready && (open !== "acts" || (typeof ACTIVITIES !== "undefined" && ACTIVITIES.length >= 0))) {
      clearInterval(iv);
      try {
        if (open === "acts") {
          go("acts");
          if (q) {
            var inp = document.getElementById("actSearch");
            if (inp) inp.value = q;
            if (typeof setActSearch === "function") setActSearch(q);
          }
          if (window.toast) toast("Đang xem hoạt động của khách hàng: " + q);
        }
      } catch (e) { /* im lặng */ }
    }
    if (tries > 120) clearInterval(iv);   // ~36s thì bỏ
  }, 300);
})();
