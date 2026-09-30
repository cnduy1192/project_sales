/* ═══════════════════════════════════════════════════════════════════════
   Lớp TRAINING cho rnd-workspace-demo.html (bản demo R&D Workspace)
   CHỈ nạp trong rnd-workspace-demo.html — file này sinh từ index.html bởi tools/build-rnd-demo.py.
   - Dữ liệu mô phỏng (js/data/demo-funnel.js), không đăng nhập, không gọi SharePoint / Microsoft Graph.
   - Mỗi lần tải trang là dữ liệu gốc; thao tác thử chỉ nằm trong bộ nhớ trình duyệt.
   - Thanh demo: đổi vai (Sales / R&D / Manager / Director), kịch bản training, góp ý (xuất CSV),
     làm lại dữ liệu demo.
   - Góp ý lưu trong localStorage của máy (khoá riêng, KHÔNG bị xoá khi làm lại dữ liệu) → tải file CSV gửi lại.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (!window.FISG_DEMO_AUTO) return;

  var DEMO_DOMAIN = "@demo.local";           // email giả → không đụng dữ liệu cục bộ của tài khoản thật
  var FB_KEY = "fisg_rnd_demo_feedback_v1";
  var FB_NAME_KEY = "fisg_rnd_demo_reviewer";

  function tr(k, p) { return typeof T === "function" ? T(k, p) : k; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function slug(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* ── 1. Luôn bắt đầu từ dữ liệu gốc: xoá dữ liệu cục bộ của các tài khoản demo ── */
  try {
    var drop = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (/^(fisg_local_|fisg_rnd_v1_|fisg_notif_seen_).*@demo\.local$/.test(k)) drop.push(k);
    }
    drop.forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) {}

  /* ── 2. Link sang Sales Funnel → bản demo ── */
  var origUrl = window.salesFunnelUrl;
  if (typeof origUrl === "function") {
    window.salesFunnelUrl = function (extra) { return String(origUrl(extra)).replace(/^salesfunnel\.html/, "salesfunnel-demo.html"); };
  }
  window.openSalesFunnel = function (e, extra) {
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) return true;
    if (e && e.preventDefault) e.preventDefault();
    location.href = window.salesFunnelUrl ? window.salesFunnelUrl(extra) : "salesfunnel-demo.html";
    return false;
  };
  /* Không tự bật "Kế hoạch tuần" khi đổi vai — tránh che màn hình lúc training */
  window.wcMaybeAutoOpen = function () {};

  /* ── 3. Người dùng demo + dữ liệu minh hoạ phân quyền ── */
  var EXTRA_USERS = [
    { name: "Trần Minh", pic: "Minh", role: "rnd", color: "#0F766E" },
    { name: "Đặng Quốc Bảo", pic: "Bảo", role: "director", color: "#334155" }
  ];
  function prepareData() {
    if (typeof USERS === "undefined") return;
    EXTRA_USERS.forEach(function (x) {
      if (!USERS.some(function (u) { return u.pic === x.pic; })) USERS.push(Object.assign({}, x));
    });
    USERS.forEach(function (u) { if (!/@demo\.local$/.test(u.email || "")) u.email = (slug(u.pic || u.name) || "user") + DEMO_DOMAIN; });
    /* RD-2026-005 giao cho Minh → so sánh quyền "PIC sửa được" / "R&D khác chỉ xem" */
    [typeof RD_PROJECTS !== "undefined" ? RD_PROJECTS : [], window.DEMO_RD_LIST || []].forEach(function (arr) {
      arr.forEach(function (r) {
        if (r.code === "RD-2026-005" && !r.__demoPrepared) { r.pic = "Minh"; r.collaborators = ["Lan"]; r.__demoPrepared = true; }
      });
    });
  }
  function userIndex(pic) { return USERS.findIndex(function (u) { return u.pic === pic; }); }

  /* ── 4. Bọc loginAs: chuẩn hoá dữ liệu trước, vào thẳng R&D Workspace sau ── */
  var origLogin = window.loginAs, booted = false;
  window.loginAs = function (i) {
    prepareData();
    origLogin(i);
    afterLogin();
  };
  function afterLogin() {
    ["navUsers", "navAdminLabel"].forEach(function (id) { var el = $(id); if (el) el.style.display = "none"; });
    /* Thanh demo (đổi vai / kịch bản / góp ý) đã ẩn theo yêu cầu — bật lại bằng mountBar(); syncRoleSelect(); */
    if (!pendingAction && typeof go === "function") go("rnd");
    if (!booted) {
      booted = true;
      setTimeout(function () { if (window.toast) toast(tr("rdd.toast")); }, 250);
    }
  }

  /* ── 5. Thanh demo ── */
  var ICON = {
    flag: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V4M4 4h13l-2 4 2 4H4"/></svg>',
    msg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/></svg>',
    reset: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    dl: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>',
    copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
  };
  function roleName(u) { return (typeof roleLabel === "function" ? roleLabel(u.role) : u.role); }
  function mountBar() {
    var main = document.querySelector(".rdw-main") || document.querySelector(".main"); if (!main) return;
    var bar = $("rddBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "rddBar"; bar.className = "rdd-bar"; bar.setAttribute("role", "region");
      main.insertBefore(bar, main.firstChild);
      bar.addEventListener("click", function (e) {
        var b = e.target.closest("[data-rdd]"); if (!b) return;
        var a = b.getAttribute("data-rdd");
        if (a === "guide") openPanel("guide");
        else if (a === "fb") openPanel("fb");
        else if (a === "reset") { if (confirm(tr("rdd.resetConfirm"))) location.reload(); }
      });
      bar.addEventListener("change", function (e) {
        if (e.target.id === "rddRole") { var i = +e.target.value; if (i >= 0) window.loginAs(i); }
      });
    }
    bar.setAttribute("aria-label", tr("rdd.tag"));
    var order = ["superadmin", "manager", "director", "rnd", "teamlead", "sales", "salesupport"];
    var users = USERS.map(function (u, i) { return { u: u, i: i }; })
      .sort(function (a, b) { return order.indexOf(a.u.role) - order.indexOf(b.u.role); });
    var groups = {};
    users.forEach(function (x) { (groups[x.u.role] = groups[x.u.role] || []).push(x); });
    var opts = order.filter(function (r) { return groups[r]; }).map(function (r) {
      return '<optgroup label="' + esc(roleName({ role: r })) + '">' + groups[r].map(function (x) {
        return '<option value="' + x.i + '">' + esc(x.u.name) + "</option>";
      }).join("") + "</optgroup>";
    }).join("");
    bar.innerHTML =
      '<span class="rdd-tag">' + esc(tr("rdd.tag")) + "</span>" +
      '<span class="rdd-note" title="' + esc(tr("rdd.note")) + '">' + esc(tr("rdd.noteShort")) + "</span>" +
      '<label class="rdd-role"><span>' + esc(tr("rdd.roleLabel")) + '</span><select id="rddRole" aria-label="' + esc(tr("rdd.roleLabel")) + '">' + opts + "</select></label>" +
      '<button type="button" class="rdd-btn is-primary" data-rdd="guide">' + ICON.flag + "<span>" + esc(tr("rdd.guide")) + "</span></button>" +
      '<button type="button" class="rdd-btn" data-rdd="fb">' + ICON.msg + "<span>" + esc(tr("rdd.fb")) + '</span><span class="rdd-n" id="rddFbN"></span></button>' +
      '<button type="button" class="rdd-btn is-ghost" data-rdd="reset" title="' + esc(tr("rdd.resetHint")) + '">' + ICON.reset + "<span>" + esc(tr("rdd.reset")) + "</span></button>";
    syncRoleSelect(); syncFbCount();
  }
  function syncRoleSelect() {
    var sel = $("rddRole"); if (!sel || typeof me === "undefined" || !me) return;
    sel.value = String(USERS.indexOf(me));
  }

  /* ── 6. Kịch bản training ── */
  var SCENARIOS = [
    { id: 1, pic: "Hùng", run: function () { go("funnel"); openDetail("FI-0011"); } },
    { id: 2, pic: "Khoa", run: function () { go("rnd"); RND_WORKSPACE.focus("RD-2026-004"); } },
    { id: 3, pic: "Hùng", run: function () { go("funnel"); openDetail("FI-0008"); } },
    { id: 4, pic: "Minh", run: function () { go("rnd"); RND_WORKSPACE.focus("RD-2026-003"); } },
    { id: 5, pic: "Duy", run: function () { go("rnd"); RND_WORKSPACE.state.mode = "matrix"; RND_WORKSPACE.render(); } },
    { id: 6, pic: "Bảo", run: function () { go("rnd"); RND_WORKSPACE.focus("RD-2026-001"); } }
  ];
  var pendingAction = null;
  function runScenario(id) {
    var sc = SCENARIOS.filter(function (x) { return x.id === id; })[0]; if (!sc) return;
    closePanel();
    var i = userIndex(sc.pic);
    pendingAction = sc;
    if (i >= 0 && USERS[i] !== me) window.loginAs(i);
    pendingAction = null;
    if (typeof closeActivityModal === "function") try { closeActivityModal(true); } catch (e) {}
    var dov = $("dov"); if (dov && dov.classList.contains("open")) dov.classList.remove("open");
    setTimeout(function () {
      try { sc.run(); } catch (e) { console.error("[demo]", e); }
      if (window.toast) toast(tr("rdd.sc.started", { n: id, u: (me && me.name) || "" }));
    }, 60);
  }
  function guideHTML() {
    var u = function (pic) { var i = userIndex(pic); return i >= 0 ? USERS[i] : { name: pic, role: "" }; };
    return '<p class="rdd-lead">' + esc(tr("rdd.guideLead")) + "</p>" +
      SCENARIOS.map(function (sc) {
        var usr = u(sc.pic);
        var steps = String(tr("rdd.sc." + sc.id + ".steps")).split("\n").filter(Boolean);
        return '<section class="rdd-sc">' +
          '<div class="rdd-sc-h"><span class="rdd-sc-n">' + sc.id + "</span><div><h4>" + esc(tr("rdd.sc." + sc.id + ".title")) + "</h4>" +
            '<span class="rdd-sc-role">' + esc(usr.name) + " · " + esc(roleName(usr)) + "</span></div></div>" +
          '<p class="rdd-sc-goal">' + esc(tr("rdd.sc." + sc.id + ".goal")) + "</p>" +
          "<ol>" + steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" +
          '<button type="button" class="rdd-btn is-primary" data-sc="' + sc.id + '">' + esc(tr("rdd.sc.start", { u: usr.name })) + "</button>" +
        "</section>";
      }).join("");
  }

  /* ── 7. Góp ý ── */
  var FB = { type: "BUG", prio: "MED" };
  function fbList() { var a = lsGet(FB_KEY, []); return Array.isArray(a) ? a : []; }
  function syncFbCount() { var n = $("rddFbN"); if (n) { var c = fbList().length; n.textContent = c ? c : ""; n.hidden = !c; } }
  function currentContext() {
    var views = typeof VIEWS !== "undefined" ? VIEWS : [];
    var v = views.filter(function (x) { var el = $("view-" + x); return el && el.style.display !== "none"; })[0] || ($("view-rnd") ? "rnd" : "");   // trang R&D riêng không có VIEWS
    var ctx = { view: v, viewLabel: v === "rnd" ? tr("nav.rnd") : (document.querySelector('.nav-item[data-view="' + v + '"] .nav-t') || {}).textContent || v, ref: "" };
    var dov = $("dov");
    if (dov && dov.classList.contains("open") && typeof curRec !== "undefined" && curRec) { ctx.viewLabel = tr("rdd.ctx.detail"); ctx.ref = curRec.id; }
    else if (v === "rnd" && window.RND_WORKSPACE) {
      var st = RND_WORKSPACE.state;
      ctx.viewLabel += " · " + (st.mode === "matrix" ? tr("rdw.view.matrix") : tr("rdw.view.split"));
      if (st.mode !== "matrix" && st.sel) ctx.ref = st.sel;
    }
    var rq = $("rndReqOv"); if (rq && rq.classList.contains("open")) ctx.viewLabel = tr("rd.requestSupport");
    return ctx;
  }
  var TYPES = ["BUG", "UX", "IDEA", "QUESTION"], PRIOS = ["HIGH", "MED", "LOW"];
  function fbHTML() {
    var ctx = currentContext(), items = fbList().slice().reverse();
    var seg = function (name, vals, cur) {
      return '<div class="rdd-seg" role="radiogroup">' + vals.map(function (v) {
        return '<button type="button" role="radio" aria-checked="' + (v === cur) + '" class="' + (v === cur ? "on" : "") + '" data-fb-' + name + '="' + v + '">' + esc(tr("rdd.fb." + name + "." + v)) + "</button>";
      }).join("") + "</div>";
    };
    return '<p class="rdd-lead">' + esc(tr("rdd.fbLead")) + "</p>" +
      '<div class="rdd-ctx"><b>' + esc(tr("rdd.fb.ctx")) + "</b> " + esc(ctx.viewLabel) + (ctx.ref ? " · " + esc(ctx.ref) : "") +
        " · " + esc(tr("rdd.fb.asRole", { u: (me && me.name) || "—", r: me ? roleName(me) : "" })) + "</div>" +
      '<div class="rdd-f"><span class="rdd-l">' + esc(tr("rdd.fb.typeL")) + "</span>" + seg("type", TYPES, FB.type) + "</div>" +
      '<div class="rdd-f"><span class="rdd-l">' + esc(tr("rdd.fb.prioL")) + "</span>" + seg("prio", PRIOS, FB.prio) + "</div>" +
      '<div class="rdd-f"><label class="rdd-l" for="rddFbText">' + esc(tr("rdd.fb.textL")) + ' <i class="req">*</i></label>' +
        '<textarea id="rddFbText" rows="4" placeholder="' + esc(tr("rdd.fb.textPh")) + '"></textarea></div>' +
      '<div class="rdd-f"><label class="rdd-l" for="rddFbName">' + esc(tr("rdd.fb.nameL")) + '</label>' +
        '<input id="rddFbName" value="' + esc(lsGet(FB_NAME_KEY, "")) + '" placeholder="' + esc(tr("rdd.fb.namePh")) + '"></div>' +
      '<div class="rdd-f-act"><span class="rdd-err" id="rddFbErr" role="alert"></span><button type="button" class="rdd-btn is-primary" data-fb="save">' + esc(tr("rdd.fb.save")) + "</button></div>" +
      '<div class="rdd-fb-list"><div class="rdd-fb-h"><b>' + esc(tr("rdd.fb.saved", { n: items.length })) + "</b>" +
        (items.length ? '<span><button type="button" class="rdd-btn is-ghost" data-fb="copy">' + ICON.copy + "<span>" + esc(tr("rdd.fb.copy")) + "</span></button>" +
          '<button type="button" class="rdd-btn" data-fb="csv">' + ICON.dl + "<span>" + esc(tr("rdd.fb.csv")) + "</span></button></span>" : "") + "</div>" +
        (items.length ? "<ul>" + items.map(function (x) {
          return '<li><div class="rdd-fb-meta"><span class="rdd-chip t-' + esc(x.type.toLowerCase()) + '">' + esc(tr("rdd.fb.type." + x.type)) + "</span>" +
            '<span class="rdd-chip p-' + esc(x.prio.toLowerCase()) + '">' + esc(tr("rdd.fb.prio." + x.prio)) + "</span>" +
            "<small>" + esc(x.at) + " · " + esc(x.reviewer || x.asUser) + " · " + esc(x.screen) + (x.ref ? " · " + esc(x.ref) : "") + "</small>" +
            '<button type="button" class="rdd-x" data-fb-del="' + esc(x.id) + '" aria-label="' + esc(tr("rdd.fb.del")) + '" title="' + esc(tr("rdd.fb.del")) + '">' + ICON.trash + "</button></div>" +
            "<p>" + esc(x.text) + "</p></li>";
        }).join("") + "</ul>" : '<p class="rdd-empty">' + esc(tr("rdd.fb.none")) + "</p>") +
      "</div>";
  }
  function nowText() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function saveFb() {
    var text = ($("rddFbText").value || "").trim(), name = ($("rddFbName").value || "").trim();
    if (!text) { $("rddFbErr").textContent = tr("rdd.fb.need"); $("rddFbText").focus(); return; }
    lsSet(FB_NAME_KEY, name);
    var ctx = panelCtx || currentContext(), list = fbList();
    list.push({ id: "F" + Date.now().toString(36), at: nowText(), type: FB.type, prio: FB.prio, text: text,
      reviewer: name, asUser: me ? me.name : "", asRole: me ? roleName(me) : "", screen: ctx.viewLabel, ref: ctx.ref,
      lang: window.I18N && I18N.lang ? I18N.lang() : "vi" });
    if (!lsSet(FB_KEY, list)) { $("rddFbErr").textContent = tr("rdd.fb.storeFail"); return; }
    renderPanel("fb"); syncFbCount();
    if (window.toast) toast(tr("rdd.fb.thanks"));
  }
  function csvCell(v) { v = String(v == null ? "" : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function fbCsv() {
    var head = ["rdd.col.at", "rdd.col.reviewer", "rdd.col.asUser", "rdd.col.asRole", "rdd.col.screen", "rdd.col.ref", "rdd.col.type", "rdd.col.prio", "rdd.col.text"].map(tr);
    var rows = fbList().map(function (x) {
      return [x.at, x.reviewer, x.asUser, x.asRole, x.screen, x.ref, tr("rdd.fb.type." + x.type), tr("rdd.fb.prio." + x.prio), x.text];
    });
    return "﻿" + [head].concat(rows).map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
  }
  function downloadCsv() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    var name = "gop-y-rnd-workspace-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + ".csv";
    var url = URL.createObjectURL(new Blob([fbCsv()], { type: "text/csv;charset=utf-8" }));
    var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function copyAll() {
    var txt = fbList().map(function (x, i) {
      return (i + 1) + ". [" + tr("rdd.fb.type." + x.type) + " · " + tr("rdd.fb.prio." + x.prio) + "] " + x.screen + (x.ref ? " · " + x.ref : "") +
        " — " + (x.reviewer || x.asUser) + " (" + x.at + ")\n   " + x.text.replace(/\n/g, "\n   ");
    }).join("\n");
    var done = function () { if (window.toast) toast(tr("rdd.fb.copied")); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); });
    else { fallbackCopy(txt); done(); }
  }
  function fallbackCopy(txt) { var t = document.createElement("textarea"); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (e) {} t.remove(); }

  /* ── 8. Ngăn kéo (Kịch bản / Góp ý) ── */
  var panelKind = null, panelCtx = null, lastFocus = null;
  function ensurePanel() {
    var ov = $("rddOv"); if (ov) return ov;
    ov = document.createElement("div");
    ov.id = "rddOv"; ov.className = "rdd-ov";
    ov.innerHTML = '<aside class="rdd-panel" role="dialog" aria-modal="true" aria-labelledby="rddPanelT" tabindex="-1" id="rddPanel">' +
      '<header class="rdd-ph"><h3 id="rddPanelT"></h3><button type="button" class="rdd-x" data-rdd-close aria-label="' + esc(tr("common.close")) + '">' + ICON.x + "</button></header>" +
      '<div class="rdd-pb" id="rddPanelBody"></div></aside>';
    document.body.appendChild(ov);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) closePanel(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov.classList.contains("open")) { e.stopPropagation(); closePanel(); } }, true);
    ov.addEventListener("click", function (e) {
      var t = e.target.closest("button"); if (!t) return;
      if (t.hasAttribute("data-rdd-close")) closePanel();
      else if (t.getAttribute("data-sc")) runScenario(+t.getAttribute("data-sc"));
      else if (t.getAttribute("data-fb-type")) { FB.type = t.getAttribute("data-fb-type"); keepFbDraft(); }
      else if (t.getAttribute("data-fb-prio")) { FB.prio = t.getAttribute("data-fb-prio"); keepFbDraft(); }
      else if (t.getAttribute("data-fb") === "save") saveFb();
      else if (t.getAttribute("data-fb") === "csv") downloadCsv();
      else if (t.getAttribute("data-fb") === "copy") copyAll();
      else if (t.getAttribute("data-fb-del")) {
        if (!confirm(tr("rdd.fb.delConfirm"))) return;
        var id = t.getAttribute("data-fb-del");
        lsSet(FB_KEY, fbList().filter(function (x) { return x.id !== id; })); keepFbDraft(); syncFbCount();
      }
    });
    return ov;
  }
  /* Vẽ lại ngăn góp ý nhưng giữ nội dung đang gõ */
  function keepFbDraft() {
    var t = $("rddFbText"), n = $("rddFbName"), tv = t ? t.value : "", nv = n ? n.value : null;
    renderPanel("fb");
    if ($("rddFbText")) $("rddFbText").value = tv;
    if (nv != null && $("rddFbName")) $("rddFbName").value = nv;
  }
  function renderPanel(kind) {
    $("rddPanelT").textContent = tr(kind === "guide" ? "rdd.guide" : "rdd.fb");
    $("rddPanelBody").innerHTML = kind === "guide" ? guideHTML() : fbHTML();
    if (kind === "fb" && panelCtx) {
      var c = $("rddPanelBody").querySelector(".rdd-ctx");
      if (c) c.innerHTML = "<b>" + esc(tr("rdd.fb.ctx")) + "</b> " + esc(panelCtx.viewLabel) + (panelCtx.ref ? " · " + esc(panelCtx.ref) : "") +
        " · " + esc(tr("rdd.fb.asRole", { u: (me && me.name) || "—", r: me ? roleName(me) : "" }));
    }
  }
  function openPanel(kind) {
    var ov = ensurePanel();
    panelCtx = kind === "fb" ? currentContext() : null;   // ghi nhận màn hình TRƯỚC khi mở ngăn góp ý
    panelKind = kind; lastFocus = document.activeElement;
    renderPanel(kind);
    ov.classList.add("open");
    setTimeout(function () { var f = kind === "fb" ? $("rddFbText") : $("rddPanel"); if (f) f.focus(); }, 30);
  }
  function closePanel() {
    var ov = $("rddOv"); if (!ov) return;
    ov.classList.remove("open"); panelKind = null;
    if (lastFocus && document.contains(lastFocus)) try { lastFocus.focus(); } catch (e) {}
  }

  /* Đổi ngôn ngữ → vẽ lại thanh demo và ngăn đang mở */
  if (window.I18N && I18N.onChange) I18N.onChange(function () {
    if (!$("rddBar")) return;
    mountBar();
    if (panelKind) renderPanel(panelKind);
  });

  window.RND_DEMO = { runScenario: runScenario, openPanel: openPanel, feedback: fbList, csv: fbCsv };
})();
