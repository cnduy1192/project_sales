/* js/login-ui.js — Dựng lại màn đăng nhập (nạp CUỐI CÙNG).
 * Không tạo mới nút .ms-btn / #roleRow — DI CHUYỂN node có sẵn để giữ nguyên handler
 * do auth.js và config.js đã gắn. Nút khách đổi nhãn thành "Guest". */
(function () {
  "use strict";

  const NCC_COLOR = { "Roquette": "#3B6BE0", "IFF": "#14B8A6", "Kimica": "#A78BFA" };
  const FALLBACK = ["#3B6BE0", "#14B8A6", "#A78BFA"];

  function counts() {
    const recs = (typeof RECORDS !== "undefined" && RECORDS) || [];
    const by = {};
    recs.forEach(r => { if (r.ncc) by[r.ncc] = (by[r.ncc] || 0) + 1; });
    const names = (typeof LISTS !== "undefined" && LISTS.nccs && LISTS.nccs.length)
      ? LISTS.nccs.slice() : Object.keys(by);
    return names.map((n, i) => ({
      name: n, n: by[n] || 0, color: NCC_COLOR[n] || FALLBACK[i % FALLBACK.length],
    }));
  }

  function build() {
    const login = document.getElementById("login");
    if (!login || login.dataset.rebuilt) return;
    void counts;                     // giữ hàm cho lần dùng sau, không hiển thị số liệu ở cửa
    const msBtn = login.querySelector(".ms-btn");
    const roleRow = login.querySelector("#roleRow");
    if (!msBtn || !roleRow) return;              // chưa sẵn sàng, thử lại sau
    const guestBtn = login.querySelector("#btnGuest");

    const shell = document.createElement("div");
    shell.className = "login-shell";
    shell.innerHTML =
      '<aside class="lg-brand">' +
        '<div class="lg-top">' +
          '<div class="lg-eyebrow"><span class="lg-mark">FI</span>FI SAIGON JSC</div>' +
          '<p class="lg-slogan">Right partner. High value</p>' +
        '</div>' +
        '<h1 class="lg-title">Sales<br>Funnel</h1>' +
        '<span aria-hidden="true"></span>' +
      '</aside>' +
      '<main class="lg-pane">' +
        '<h2 class="lg-h2">Đăng nhập</h2>' +
        '<div class="lg-actions" id="lgActions"></div>' +
      '</main>';

    const card = login.querySelector(".login-card");
    login.appendChild(shell);
    const actions = shell.querySelector("#lgActions");

    actions.appendChild(msBtn);                                   // giữ handler đăng nhập MS
    const or = document.createElement("div");
    or.className = "lg-or"; or.textContent = "hoặc";
    actions.appendChild(or);

    // nút Guest: đổi nhãn, giữ nguyên hành vi (mở popup nhập mã)
    const g = guestBtn || document.createElement("button");
    if (!guestBtn) {
      g.id = "btnGuest"; g.type = "button"; g.className = "guest-btn";
      g.onclick = () => { if (window.FISG_GUEST) FISG_GUEST.screen(); };
    }
    g.innerHTML =
      '<span class="lg-guest-ico" aria-hidden="true">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="14" r="4.2"/><path d="M11 11l8.5-8.5M17 5l2.5 2.5M14.5 7.5L17 10"/></svg>' +
      '</span>' +
      '<span class="lg-guest-t">Guest</span>' +
      '<svg class="lg-arrow" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    actions.appendChild(g);

    /* Không còn đăng nhập nhanh theo vai trò — mọi tài khoản đến từ Microsoft 365,
       phân quyền đọc từ list Users. Giữ node #roleRow (ẩn) vì vài chỗ còn tham chiếu. */
    if (roleRow) { roleRow.style.display = "none"; shell.appendChild(roleRow); }
    if (card) card.remove();
    login.dataset.rebuilt = "1";
  }

  function boot() {
    build();
    setTimeout(build, 300);      // phòng khi guest.js gắn nút muộn hơn
    setTimeout(build, 900);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
