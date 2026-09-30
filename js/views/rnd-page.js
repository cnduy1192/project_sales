/* ============================================================
   R&D Workspace — trang riêng rnd-workspace.html
   Tái dùng tầng data của app chính (catalog/config/roles/store/auth/rnd-core) như salesfunnel.html,
   host của giao diện là #view-rnd (js/views/rnd-workspace.js). KHÔNG đụng DOM của index.html.
   - loginAs: auth.js gọi khi đã xác thực (bản demo: demo-funnel.js gọi)
   - go(): cầu nối cho code dùng chung — "rnd" = vẽ lại; "funnel"/"acts" = chuyển sang trang tương ứng
   - Deeplink (?open=&mode=&type=&ncc=&q=): RND_WORKSPACE.applyDeepLink()
   ============================================================ */
(function () {
  "use strict";

  var booted = false;
  var demo = !!window.FISG_DEMO_AUTO;

  /* ---------- toast (trang riêng, không phụ thuộc modal của index) ---------- */
  var _toastT;
  window.toast = function (m) {
    var t = document.getElementById("toastEl"); if (!t) return;
    t.textContent = m; t.style.display = "block";
    clearTimeout(_toastT); _toastT = setTimeout(function () { t.style.display = "none"; }, 4600);
  };
  function initials(n) { return String(n || "?").trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase(); }

  function funnelBase() { return demo ? "salesfunnel-demo.html" : "salesfunnel.html"; }
  function funnelUrl(open) { return funnelBase() + "?from=rnd" + (open ? "&open=" + encodeURIComponent(open) : ""); }

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /* Avatar + popover hồ sơ: header dùng chung (js/lib/app-header.js) */
  function renderUser() {
    if (!me || !window.APP_HEADER) return;
    APP_HEADER.setUser(me, {
      email: demo ? "" : me.email,
      links: [{ href: demo ? "salesfunnel-demo.html" : "index.html", label: T("sf.backToApp") }, { href: funnelUrl(), label: T("nav.openFunnel") }]
    });
    if (window.RND_WORKSPACE) RND_WORKSPACE.syncRing();
  }
  function render() { if (window.RND_WORKSPACE) RND_WORKSPACE.render(); }

  function loginAs(i) {
    me = USERS[i];
    if (!me) return;
    nccFilter = ALL_NCC;
    document.getElementById("sfLogin").style.display = "none";
    document.getElementById("sfApp").style.display = "flex";
    renderUser();
    if (!booted && window.RND_WORKSPACE) { booted = true; RND_WORKSPACE.applyDeepLink(); }   // đọc ?open=&mode=… 1 lần
    render();
  }
  window.loginAs = loginAs;

  // store.js gọi sau mỗi lần đồng bộ SharePoint
  window.render = function () { try { render(); } catch (e) {} };
  window.rebuildNccTabs = function () {};
  window.buildForm = function () {};
  window.buildUsers = function () {};

  /* ---------- cầu nối go() / openDetail() cho code dùng chung ---------- */
  window.go = function (v) {
    if (v === "rnd") { render(); return; }
    if (v === "acts") { if (!demo) location.href = "index.html?open=acts&from=rnd"; return; }
    if (v === "funnel") { location.href = funnelUrl(); return; }
  };
  window.rndFunnelUrl = function () { return funnelUrl(); };
  window.openDetail = function (id) { location.href = funnelUrl(id); };   // mở dự án Sales ở Sales Funnel
  window.openSalesFunnelFromRnd = function (e) {
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) return true;
    if (e && e.preventDefault) e.preventDefault();
    location.href = funnelUrl();
    return false;
  };
})();
