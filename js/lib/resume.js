/* ============================================================
   Vào thẳng app khi đã có phiên Microsoft 365 (MSAL cache trong localStorage).
   Nạp SỚM trong <head> của index.html và salesfunnel.html:
   - Có tài khoản MSAL đã lưu → gắn class html.fisg-resuming → CSS ẩn màn hình đăng nhập,
     hiện splash "Đang mở phiên làm việc…" trong lúc auth.js xác thực lại (không popup).
   - auth.js gọi FISG_RESUME.done() khi đã vào app HOẶC khi không vào được (hiện lại login).
   - Link khách (?key=…) không áp dụng. An toàn: sau 20 giây tự bỏ splash.
   ============================================================ */
(function () {
  var root = document.documentElement;
  var has = false;
  try {
    if (!/[?&]key=/.test(location.search) && location.protocol !== "file:") {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^msal\.(\d+\.)?account\.keys$/.test(k)) {
          var v = JSON.parse(localStorage.getItem(k) || "[]");
          if (v && v.length) { has = true; break; }
        }
      }
    }
  } catch (e) {}
  if (has) root.classList.add("fisg-resuming");
  window.FISG_RESUME = {
    active: has,
    done: function () { root.classList.remove("fisg-resuming"); this.active = false; }
  };
  if (has) setTimeout(function () { if (window.FISG_RESUME.active) window.FISG_RESUME.done(); }, 20000);
})();
