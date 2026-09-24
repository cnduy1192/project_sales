/* ============================================================
   Deep-link giữa index.html ⇄ salesfunnel.html
   1) index.html?open=acts&q=<khách hàng>
      Mở từ salesfunnel.html → tự vào view Hoạt động và lọc.
   2) openSalesFunnel(event, extra) — menu "Sales Funnel" ở index
      → salesfunnel.html?ncc=…&status=…&q=…&open=<mã dự án>&from=index
      (mang theo bộ lọc hiện tại; salesfunnel.html dùng lại phiên M365 → không qua màn hình đăng nhập)
   ============================================================ */
(function () {
  "use strict";

  /* ---------- (2) Tạo deeplink sang salesfunnel.html ---------- */
  var STATUS_OK = { "IN PROGRESS": 1, "WON": 1, "LOST": 1 };

  function salesFunnelUrl(extra) {
    extra = extra || {};
    var p = new URLSearchParams();
    var ncc = extra.ncc != null ? extra.ncc
      : (typeof nccFilter !== "undefined" && nccFilter && !(typeof isAllNcc === "function" && isAllNcc()) ? nccFilter : "");
    if (ncc) p.set("ncc", ncc);
    var st = extra.status != null ? extra.status : (typeof filter !== "undefined" && STATUS_OK[filter] ? filter : "");
    if (st && STATUS_OK[st]) p.set("status", st);
    var qEl = document.getElementById("q");
    var q = extra.q != null ? extra.q : (qEl ? qEl.value.trim() : "");
    if (q) p.set("q", q);
    if (extra.open) p.set("open", extra.open);
    p.set("from", "index");
    return "salesfunnel.html?" + p.toString();
  }

  function openSalesFunnel(e, extra) {
    // Khách (guest) chỉ xem dữ liệu đã lọc ở index → giữ ở view funnel nội bộ
    if (typeof me !== "undefined" && me && me.role === "guest") {
      if (e && e.preventDefault) e.preventDefault();
      if (window.go) go("funnel");
      return false;
    }
    var url = salesFunnelUrl(extra);
    var a = e && e.currentTarget && e.currentTarget.tagName === "A" ? e.currentTarget : null;
    if (a) a.href = url;
    // Ctrl/⌘/Shift/chuột giữa → để trình duyệt tự mở tab mới với href đã cập nhật
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) return true;
    if (e && e.preventDefault) e.preventDefault();
    location.href = url;
    return false;
  }
  window.salesFunnelUrl = salesFunnelUrl;
  window.openSalesFunnel = openSalesFunnel;

  // cập nhật href khi rê chuột / focus để "Mở trong tab mới" (chuột phải) cũng đúng deeplink
  function refreshHref(ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('a[href^="salesfunnel.html"]');
    if (a) a.href = salesFunnelUrl();
  }
  document.addEventListener("mouseover", refreshHref, true);
  document.addEventListener("focusin", refreshHref, true);
  document.addEventListener("contextmenu", refreshHref, true);

  /* ---------- (1) Đọc deeplink ?open=acts ---------- */
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { return; }
  var open = params.get("open");
  if (!open) return;
  // client_id do trang Báo cáo gửi sang; giữ tương thích tham số q cũ (từ salesfunnel.html).
  var q = params.get("client_id") || params.get("q") || "";
  var actId = params.get("activity_id") || "";

  var tries = 0;
  var navigated = false;
  var iv = setInterval(function () {
    tries++;
    var ready = (typeof me !== "undefined" && me && typeof window.go === "function");
    if (ready && (open !== "acts" || typeof ACTIVITIES !== "undefined")) {
      try {
        if (open !== "acts") { clearInterval(iv); return; }
        if (!navigated) {
          navigated = true;
          go("acts");
          if (q) {
            var inp = document.getElementById("actSearch");
            if (inp) inp.value = q;
            if (typeof setActSearch === "function") setActSearch(q);
          }
          if (window.toast) toast(T("dl.viewingActs", { q: q }));
        }
        // Không có activity_id → xong. Có → chờ ACTIVITIES nạp xong rồi mở đúng hoạt động.
        if (!actId) { clearInterval(iv); return; }
        var found = ACTIVITIES.some(function (x) { return x.id === actId; });
        if (found) {
          if (typeof openActivityModal === "function") openActivityModal(actId);
          else if (typeof openActEdit === "function") openActEdit(actId);
          clearInterval(iv);
          return;
        }
        // hoạt động chưa nạp (dữ liệu SharePoint về sau) → thử lại ở nhịp kế tiếp
      } catch (e) { clearInterval(iv); }
    }
    if (tries > 120) clearInterval(iv);   // ~36s thì bỏ
  }, 300);
})();
