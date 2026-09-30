/* ============================================================
   HEADER DÙNG CHUNG — avatar + popover hồ sơ + viền trạng thái đồng bộ
   Dùng ở salesfunnel(.html|-demo.html) và rnd-workspace(.html|-demo.html). CSS: app-header.css
     APP_HEADER.setUser(user, { email, links:[{href,label}] })  — vẽ avatar + nội dung popover
     APP_HEADER.setSync(key, text)  — key: sharepoint | local | error | demo
   Markup: button#sfUser.sf-user[aria-controls=appProfile] + div#appProfile.app-profile trong .app-pfw
   ============================================================ */
(function () {
  "use strict";
  var sync = { key: "", text: "" };
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function initials(n) { return String(n || "?").trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase(); }
  function role(u) { return typeof roleLabel === "function" ? roleLabel(u.role) : (u.role || ""); }

  function paintSync() {
    var el = $("sfUser"); if (!el) return;
    if (sync.key) el.setAttribute("data-sync", sync.key); else el.removeAttribute("data-sync");
    var base = el.getAttribute("data-base") || "";
    el.title = base + (sync.text ? " · " + sync.text : "");
    var st = $("appPfSync");
    if (st) st.innerHTML = sync.key ? '<i class="app-pf-dot" data-sync="' + esc(sync.key) + '"></i><span>' + esc(sync.text) + "</span>" : "";
  }
  function setUser(u, opts) {
    var el = $("sfUser"), pf = $("appProfile"); if (!el || !u) return;
    opts = opts || {};
    var r = role(u), label = u.name + (r ? " · " + r : "");
    el.textContent = initials(u.name);
    el.style.background = u.color || "#01426A";
    el.setAttribute("data-base", label);
    el.setAttribute("aria-label", label);
    if (pf) pf.innerHTML =
      '<div class="app-pf-h"><b>' + esc(u.name) + "</b>" + (opts.email ? "<small>" + esc(opts.email) + "</small>" : "") +
        (r ? '<span class="app-pf-role">' + esc(r) + "</span>" : "") + "</div>" +
      '<div class="app-pf-sync" id="appPfSync"></div>' +
      (opts.links || []).map(function (l) { return '<a class="app-pf-a" href="' + esc(l.href) + '">' + esc(l.label) + "</a>"; }).join("");
    paintSync();
  }
  function setSync(key, text) { sync.key = key || ""; sync.text = text || ""; paintSync(); }

  function open(v) {
    var el = $("sfUser"), pf = $("appProfile"); if (!el || !pf) return;
    pf.hidden = !v; el.setAttribute("aria-expanded", String(!!v));
  }
  document.addEventListener("click", function (e) {
    var el = $("sfUser"), pf = $("appProfile"); if (!el || !pf) return;
    if (el.contains(e.target)) open(pf.hidden);
    else if (!pf.contains(e.target)) open(false);
  });
  document.addEventListener("keydown", function (e) {
    var pf = $("appProfile");
    if (e.key === "Escape" && pf && !pf.hidden) { open(false); var el = $("sfUser"); if (el) el.focus(); }
  });

  window.APP_HEADER = { setUser: setUser, setSync: setSync, close: function () { open(false); } };
})();
