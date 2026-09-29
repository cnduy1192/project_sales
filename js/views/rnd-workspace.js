/* ═══════════════════════════════════════════════════════════════════════
   R&D WORKSPACE — Phase 2 (js/views/rnd-workspace.js)
   Hai chế độ trong cùng view #view-rnd (index.html):
     1. Workspace (Split View): Master 380px · Detail canvas (stepper stage, benchmark,
        nhật ký mẻ thử Lab, tài liệu R&D, hoạt động liên quan).
     2. Ma trận ứng dụng: nhóm ứng dụng (CATALOG.segTree) × Nhà cung cấp.
   Dữ liệu: mảng toàn cục RD_PROJECTS (catalog.js, schema Phase 1).
   Lưu trữ + liên kết Sales (Phase 3): js/lib/rnd-core.js (window.RND) — list SharePoint RnDProjects,
   hoặc lưu cục bộ khi chưa có list, bản demo chỉ giữ trong bộ nhớ. Đổi stage / ghi mẻ thử được
   ghi ngược vào timeline dự án Sales (RND.onStageSaved / RND.onBatchLogged).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var HOST = "view-rnd";
  var ATT_HOST = "rdwAtt";
  var OTHER = "__OTHER__";
  var ST = {
    mode: "split",        // split | matrix
    type: "ALL",          // ALL | ON_DEMAND | INTERNAL
    ncc: "",              // "" = tất cả · tên cột NCC · OTHER
    q: "",
    sel: "",              // code đang chọn
    drafts: {},           // code → { field: value } chưa lưu
    mergedFor: null,      // email đã nạp overlay localStorage
    bound: false
  };

  /* ───────────── helpers ───────────── */
  function tr(k, p) { return typeof T === "function" ? T(k, p) : k; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function today() {
    if (typeof todayISO === "function") return todayISO();
    var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function nowStamp() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    return today() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function dmy(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }
  function meNow() { return (typeof me !== "undefined" && me) ? me : null; }
  function who() { var u = meNow(); return u ? (u.pic || u.name || "") : ""; }
  /* Tên hiển thị của PIC: ưu tiên đúng cách viết trong USERS (picLabel trả về khoá viết hoa) */
  function pl(p) {
    if (!p) return "";
    var k = String(p).trim().toLowerCase();
    var u = (typeof USERS !== "undefined" ? USERS : []).filter(function (x) {
      return String(x.pic || "").toLowerCase() === k || String(x.name || "").toLowerCase() === k;
    })[0];
    if (u) return u.pic || u.name;
    try { var l = window.picLabel && picLabel(p); if (l && l !== String(p).toUpperCase()) return l; } catch (e) {}
    return p;
  }
  function isDemo() { return !!window.FISG_DEMO_AUTO; }
  function list() { return typeof RD_PROJECTS !== "undefined" ? RD_PROJECTS : []; }
  function toastMsg(m) { if (window.toast) toast(m); }

  function stages() {
    var s = (typeof LISTS !== "undefined" && LISTS.rdPipelines && LISTS.rdPipelines.length) ? LISTS.rdPipelines
      : (typeof CATALOG !== "undefined" ? CATALOG.rdPipelines : []);
    return s || [];
  }
  function linearStages() { return stages().filter(function (s) { return s !== "SUSPENDED"; }); }
  function prob(s) {
    var m = (typeof LISTS !== "undefined" && LISTS.rdStageProb) || (typeof CATALOG !== "undefined" && CATALOG.rdStageProb) || {};
    return m[s] != null ? m[s] : 0;
  }
  /* Quy ước chốt ở Phase 1: COMPLETED ↔ DONE · SUSPENDED ↔ CANCELLED · còn lại IN_PROGRESS */
  function statusOfStage(s) { return s === "COMPLETED" ? "DONE" : s === "SUSPENDED" ? "CANCELLED" : "IN_PROGRESS"; }
  function stageLabel(s) { return tr("rd.pipeline." + s); }

  /* ───────────── NCC & phân nhóm ứng dụng ───────────── */
  function nKey(s) { return String(s == null ? "" : s).trim().toUpperCase(); }
  /* "Kimica-Navido" khớp cột "Kimica" (và ngược lại) — cùng quy tắc với pipelineKeyOf() */
  function nccMatch(a, b) {
    a = nKey(a); b = nKey(b);
    if (!a || !b) return false;
    if (a === b) return true;
    var pre = function (x, y) { return x.indexOf(y) === 0 && !/[A-Z0-9]/.test(x.charAt(y.length) || ""); };
    return pre(a, b) || pre(b, a);
  }
  function nccCols() {
    var src = (typeof NCCS !== "undefined" && NCCS.length) ? NCCS : (typeof CATALOG !== "undefined" ? CATALOG.nccs : []);
    return src.slice();
  }
  function colOf(r) {
    var cols = nccCols();
    for (var i = 0; i < cols.length; i++) if (nccMatch(r.ncc, cols[i])) return cols[i];
    return OTHER;
  }
  function segTree() {
    return (typeof SEG_TREE !== "undefined" && SEG_TREE) || (typeof CATALOG !== "undefined" ? CATALOG.segTree : {}) || {};
  }
  function groupOf(seg) {
    var t = segTree(), k = nKey(seg);
    var gs = Object.keys(t);
    for (var i = 0; i < gs.length; i++) if ((t[gs[i]] || []).some(function (s) { return nKey(s) === k; })) return gs[i];
    return OTHER;
  }
  function allSegments() {
    var t = segTree(), out = [];
    Object.keys(t).forEach(function (g) { (t[g] || []).forEach(function (s) { if (out.indexOf(s) < 0) out.push(s); }); });
    return out;
  }

  /* Lưu trữ dùng chung với Sales Funnel: js/lib/rnd-core.js (window.RND) */
  function ensureMerged() {
    var u = meNow(); if (!u) return;
    var k = u.email || u.name || "anon";
    if (ST.mergedFor !== k) { ST.mergedFor = k; ST.drafts = {}; ST.sel = ""; }
    if (window.RND) RND.ensureReady();
  }
  function persist(r, fields, opts) {
    if (!window.RND) return Promise.resolve(r);
    return RND.persist(r, fields, opts);
  }
  function persistFail(e) { toastMsg(tr("rnd.msg.saveFailed") + " " + (e && (e.message || e))); }
  /* Sau khi ghi: mẻ thử đã gộp với bản trên SharePoint → vẽ lại; lỗi đồng bộ → cảnh báo + nút Thử lại */
  function refreshBatches(r) {
    if (ST.sel !== r.code) return;
    var w = document.getElementById("rdwB2wrap"); if (w) w.innerHTML = block2HTML(view(r.code), canEdit(r));
  }
  function refreshSync(r) {
    refreshItem(r.code);
    if (ST.sel !== r.code) return;
    var box = document.getElementById("rdwSyncErr"); if (box) box.outerHTML = syncErrHTML(r);
  }
  function syncErrHTML(r) {
    return '<div id="rdwSyncErr">' + (r && r._syncErr
      ? '<div class="rdw-syncerr" role="alert">' + I.cloudOff + "<span>" + esc(tr("rds.notSynced")) + " " + esc(r._syncErr) + "</span>" +
        '<button type="button" class="rdw-link" data-act="retrySync">' + esc(tr("rds.retry")) + "</button></div>" : "") + "</div>";
  }
  function retrySync() {
    var r = recOf(ST.sel); if (!r) return;
    persist(r).then(function () { toastMsg(tr("rdw.saved", { c: r.code })); refreshSync(r); }, function (e) { persistFail(e); refreshSync(r); });
  }

  /* ───────────── quyền ───────────── */
  function capOf() { var u = meNow(); return (u && typeof cap === "function") ? cap(u.role) : { edit: false, scope: "" }; }
  function mine(v) { var u = meNow(); return !!(u && v && typeof isMine === "function" && isMine(v, u)); }
  function origin(r) {
    if (!r || !r.originProjectId || typeof RECORDS === "undefined") return null;
    for (var i = 0; i < RECORDS.length; i++) if (RECORDS[i].id === r.originProjectId) return RECORDS[i];
    return null;
  }
  /* Phase 4 — quyền theo js/lib/roles.js:
     xem: rdCanView · sửa (stage, thông số, mẻ thử): rdCanEdit — Manager/Super Admin mọi đề tài,
     R&D chỉ đề tài mình là PIC hoặc phối hợp; Sales chỉ xem · tạo: rdCanCreate · đổi R&D PIC: rdCanAssign */
  function canSee(r) { return rdCanView(r, meNow()); }
  function canEdit(r) { return rdCanEdit(r, meNow()); }
  function canCreate() { return rdCanCreate("ON_DEMAND", meNow()); }
  function canCreateInternal() { return rdCanCreate("INTERNAL", meNow()); }
  function canAssign() { return rdCanAssign(meNow()); }

  /* ───────────── dữ liệu hiển thị ───────────── */
  function recOf(code) { var a = list(); for (var i = 0; i < a.length; i++) if (a[i].code === code) return a[i]; return null; }
  function view(code) { var r = recOf(code); if (!r) return null; var d = ST.drafts[code]; return d ? Object.assign({}, r, d) : r; }
  function isDirty(code) { return !!ST.drafts[code]; }
  function visibleAll() { return list().filter(canSee); }
  function matchQ(r, q) {
    if (!q) return true;
    var hay = [r.code, r.title, r.customer, r.ncc, r.product, r.application, r.segment, pl(r.pic), r.originProjectId]
      .join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).every(function (w) { return !w || hay.indexOf(w) >= 0; });
  }
  var STATUS_ORDER = { IN_PROGRESS: 0, DONE: 1, CANCELLED: 2 };
  function sortRecs(a, b) {
    var s = (STATUS_ORDER[a.status] || 0) - (STATUS_ORDER[b.status] || 0);
    if (s) return s;
    return String(b.created || "").localeCompare(String(a.created || "")) || String(b.code).localeCompare(String(a.code));
  }
  function filtered(opts) {
    opts = opts || {};
    return visibleAll().filter(function (r) {
      if (!opts.ignoreType && ST.type !== "ALL" && r.type !== ST.type) return false;
      if (!opts.ignoreNcc && ST.ncc && colOf(r) !== ST.ncc) return false;
      return matchQ(r, ST.q);
    }).sort(sortRecs);
  }

  function nextCode() {
    var y = String(new Date().getFullYear()), n = 0;
    list().forEach(function (r) {
      var m = /^RD-(\d{4})-(\d+)$/.exec(String(r.code || ""));
      if (m && m[1] === y) n = Math.max(n, +m[2]);
    });
    return "RD-" + y + "-" + String(n + 1).padStart(3, "0");
  }

  /* ───────────── UI nhỏ dùng chung ───────────── */
  var I = {
    plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    split: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16"/></svg>',
    grid: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    flask: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6.5L4.6 18.2A2 2 0 006.3 21h11.4a2 2 0 001.7-2.8L14 9.5V3"/><path d="M7.5 14h9"/></svg>',
    ext: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    pause: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 6v12M15 6v12"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    cloudOff: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M8.5 8.4A5 5 0 0117 11h.5a3.5 3.5 0 012.6 5.8M16 18H7a4 4 0 01-1.4-7.8"/></svg>'
  };
  function typeBadge(t) {
    var on = t === "ON_DEMAND";
    return '<span class="rdw-type ' + (on ? "is-od" : "is-int") + '">' + (on ? "ON-DEMAND" : "INTERNAL") + "</span>";
  }
  function stageTone(s) { return s === "COMPLETED" ? "done" : s === "SUSPENDED" ? "susp" : "run"; }
  function progress(r) {
    var p = prob(r.stage);
    return '<div class="rdw-prog rdw-t-' + stageTone(r.stage) + '"><div class="rdw-prog-l"><span>' + esc(stageLabel(r.stage)) +
      '</span><b>' + p + '%</b></div><div class="rdw-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p +
      '"><i style="width:' + p + '%"></i></div></div>';
  }
  function statusPill(st) {
    var cls = st === "DONE" ? "p-won" : st === "CANCELLED" ? "p-lost" : "p-prog";
    return '<span class="pill ' + cls + '"><span class="dot"></span>' + esc(tr("rd.status." + st)) + "</span>";
  }
  function picTag(p) {
    if (!p) return '<span class="rdw-pic is-none">—</span>';
    var u = (typeof USERS !== "undefined") ? USERS.filter(function (x) { return x.pic === p || x.name === p; })[0] : null;
    var col = (u && u.color) || "var(--marine-2)";
    var ini = String(pl(p)).trim().split(/\s+/).map(function (w) { return w[0]; }).slice(-2).join("").toUpperCase();
    return '<span class="rdw-pic"><i style="background:' + esc(col) + '">' + esc(ini) + "</i>" + esc(pl(p)) + "</span>";
  }

  /* ═══════════════ RENDER ═══════════════ */
  function root() { return document.getElementById(HOST); }

  function render() {
    var el = root(); if (!el) return;
    if (!meNow()) { el.innerHTML = ""; return; }
    ensureMerged();
    bind(el);
    el.innerHTML =
      '<div class="rdw">' +
        topbarHTML() +
        '<div class="rdw-sub" id="rdwSub">' + subbarHTML() + "</div>" +
        '<div class="rdw-body" id="rdwBody"></div>' +
      "</div>";
    renderBody();
    fit();
  }

  function topbarHTML() {
    var mode = window.RND ? RND.mode() : "local";
    var sync = mode === "demo"
      ? '<span class="rdw-sync is-demo">' + esc(tr("rdw.sync.demo")) + "</span>"
      : mode === "sharepoint"
      ? '<span class="rdw-sync is-sp">' + I.check + esc(tr("rdw.sync.sp")) + "</span>"
      : '<span class="rdw-sync" title="' + esc(tr("rdw.sync.localHint")) + '">' + I.cloudOff + esc(tr("rdw.sync.local")) + "</span>";
    return '<div class="topbar rdw-top"><div class="rdw-top-l"><h2>' + esc(tr("nav.rnd")) + "</h2>" + sync + "</div>" +
      (canCreate() ? '<button type="button" class="btn-primary" data-act="create">' + I.plus + "<span>" + esc(tr("rdw.create")) + "</span></button>" : "") +
      "</div>";
  }

  function subbarHTML() {
    var base = filtered({ ignoreType: true });
    var cnt = { ALL: base.length, ON_DEMAND: 0, INTERNAL: 0 };
    base.forEach(function (r) { if (cnt[r.type] != null) cnt[r.type]++; });
    var modes = [["split", I.split, tr("rdw.view.split")], ["matrix", I.grid, tr("rdw.view.matrix")]];
    var types = [["ALL", tr("common.all")], ["ON_DEMAND", tr("rdw.f.onDemand")], ["INTERNAL", tr("rdw.f.internal")]];
    var cols = nccCols().concat([OTHER]);
    var nccOpts = '<option value="">' + esc(tr("rdw.nccAll")) + "</option>" + cols.map(function (c) {
      return '<option value="' + esc(c) + '"' + (ST.ncc === c ? " selected" : "") + ">" + esc(c === OTHER ? tr("rdw.other") : c) + "</option>";
    }).join("");
    return (
      '<div class="rdw-seg" role="tablist" aria-label="' + esc(tr("rdw.viewAria")) + '">' +
        modes.map(function (m) {
          var on = ST.mode === m[0];
          return '<button type="button" role="tab" aria-selected="' + on + '" class="' + (on ? "on" : "") + '" data-act="mode" data-v="' + m[0] + '">' + m[1] + "<span>" + esc(m[2]) + "</span></button>";
        }).join("") +
      "</div>" +
      '<div class="rdw-tabs" role="tablist" aria-label="' + esc(tr("rdw.typeAria")) + '">' +
        types.map(function (t) {
          var on = ST.type === t[0];
          return '<button type="button" role="tab" aria-selected="' + on + '" class="rdw-tab' + (on ? " on" : "") + '" data-act="type" data-v="' + t[0] + '">' +
            esc(t[1]) + ' <span class="rdw-tab-n">' + cnt[t[0]] + "</span></button>";
        }).join("") +
      "</div>" +
      '<label class="rdw-select"><span class="rdw-sr">' + esc(tr("rdw.fld.ncc")) + "</span>" +
        '<select data-act="ncc" aria-label="' + esc(tr("rdw.fld.ncc")) + '">' + nccOpts + "</select></label>" +
      '<label class="rdw-search">' + I.search +
        '<input type="search" id="rdwQ" autocomplete="off" value="' + esc(ST.q) + '" placeholder="' + esc(tr("rdw.searchPh")) + '" aria-label="' + esc(tr("rdw.searchPh")) + '" data-act="q"></label>'
    );
  }

  function renderSub() { var s = document.getElementById("rdwSub"); if (!s) return; var foc = document.activeElement && document.activeElement.id === "rdwQ"; s.innerHTML = subbarHTML(); if (foc) { var q = document.getElementById("rdwQ"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } }

  function renderBody() {
    var b = document.getElementById("rdwBody"); if (!b) return;
    b.className = "rdw-body is-" + ST.mode;
    if (ST.mode === "matrix") { b.innerHTML = matrixHTML(); return; }
    var recs = filtered();
    if (!recs.some(function (r) { return r.code === ST.sel; })) ST.sel = recs.length ? recs[0].code : "";
    b.innerHTML =
      '<div class="rdw-split">' +
        '<aside class="rdw-master" aria-label="' + esc(tr("rdw.listAria")) + '">' +
          '<div class="rdw-mhead"><span>' + esc(tr("rdw.count", { n: recs.length })) + "</span>" +
            (ST.q || ST.ncc || ST.type !== "ALL" ? '<button type="button" class="rdw-link" data-act="clear">' + esc(tr("act.clearFilters")) + "</button>" : "") +
          "</div>" +
          '<div class="rdw-mlist" id="rdwList" role="listbox" tabindex="0" aria-label="' + esc(tr("rdw.listAria")) + '">' +
            (recs.length ? recs.map(itemHTML).join("") : emptyListHTML()) +
          "</div>" +
        "</aside>" +
        '<section class="rdw-detail" id="rdwDetail" aria-live="polite"></section>' +
      "</div>";
    renderDetail();
  }

  function emptyListHTML() {
    var none = !visibleAll().length;
    return '<div class="rdw-empty-s">' + esc(tr(none ? "rdw.empty.title" : "rdw.noMatch")) + "</div>";
  }

  function itemHTML(r) {
    var v = view(r.code) || r;
    var on = r.code === ST.sel;
    var who2 = [v.customer || tr("rd.type.INTERNAL"), v.ncc].filter(Boolean).map(esc).join(" · ");
    return '<div class="rdw-item' + (on ? " is-active" : "") + (v.status !== "IN_PROGRESS" ? " is-closed" : "") + '" role="option" aria-selected="' + on + '" data-act="select" data-code="' + esc(r.code) + '" id="rdwI-' + esc(r.code) + '">' +
      '<div class="rdw-i-top"><span class="rdw-code">' + esc(r.code) + "</span>" + typeBadge(v.type) +
        (isDirty(r.code) ? '<span class="rdw-dirty" title="' + esc(tr("rdw.unsaved")) + '" aria-label="' + esc(tr("rdw.unsaved")) + '"></span>' : "") +
        (r._syncErr ? '<span class="rdw-dirty is-err" title="' + esc(tr("rds.notSynced")) + '" aria-label="' + esc(tr("rds.notSynced")) + '"></span>' : "") +
        '<span class="rdw-i-pic">' + picTag(v.pic) + "</span></div>" +
      '<div class="rdw-i-title">' + esc(v.title || "—") + "</div>" +
      '<div class="rdw-i-who">' + who2 + "</div>" +
      progress(v) +
    "</div>";
  }
  function refreshItem(code) {
    var el = document.getElementById("rdwI-" + code); if (!el) return;
    var r = recOf(code); if (!r) return;
    var tmp = document.createElement("div"); tmp.innerHTML = itemHTML(r);
    el.replaceWith(tmp.firstChild);
  }

  /* ───────────── DETAIL ───────────── */
  function renderDetail() {
    var d = document.getElementById("rdwDetail"); if (!d) return;
    var r = view(ST.sel);
    if (!r) {
      d.innerHTML = '<div class="rdw-empty">' + I.flask +
        "<h3>" + esc(tr(visibleAll().length ? "rdw.pickOne" : "rdw.empty.title")) + "</h3>" +
        (visibleAll().length ? "" : "<p>" + esc(tr("rdw.empty.body")) + "</p>" +
          (canCreate() ? '<button type="button" class="btn-primary" data-act="create">' + I.plus + "<span>" + esc(tr("rdw.create")) + "</span></button>" : "")) +
        "</div>";
      return;
    }
    var ed = canEdit(recOf(r.code));
    d.innerHTML =
      '<header class="rdw-dh">' + headHTML(r, ed) + syncErrHTML(recOf(r.code)) + "</header>" +
      '<div class="rdw-dbody">' +
        '<section class="rdw-card" aria-labelledby="rdwB1">' + block1HTML(r, ed) + "</section>" +
        '<section class="rdw-card" aria-labelledby="rdwB2" id="rdwB2wrap">' + block2HTML(r, ed) + "</section>" +
        '<div class="rdw-grid2">' +
          '<section class="rdw-card rdw-att-card"><div id="' + ATT_HOST + '"></div>' + attNoteHTML(r) + "</section>" +
          '<section class="rdw-card" aria-labelledby="rdwB3">' + actsHTML(r) + "</section>" +
        "</div>" +
        historyHTML(r) +
      "</div>";
    mountAttachments(r, ed);
    autosize(d.querySelector(".rdw-title-in"));
  }
  function autosize(t) { if (!t) return; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }

  function headHTML(r, ed) {
    var dirty = isDirty(r.code);
    var n = dirty ? Object.keys(ST.drafts[r.code]).length : 0;
    var title = ed
      ? '<textarea class="rdw-title-in" rows="1" data-act="field" data-f="title" aria-label="' + esc(tr("rdw.titlePh")) + '" placeholder="' + esc(tr("rdw.titlePh")) + '" maxlength="160">' + esc(r.title) + "</textarea>"
      : '<h3 class="rdw-title-ro">' + esc(r.title) + "</h3>";
    return '<div class="rdw-dh-top">' +
        '<div class="rdw-dh-main"><div class="rdw-dh-meta"><span class="rdw-code is-lg">' + esc(r.code) + "</span>" + typeBadge(r.type) + statusPill(r.status) +
          (ed ? "" : '<span class="rdw-ro">' + esc(tr("rdw.readOnly")) + "</span>") + "</div>" + title + "</div>" +
        (ed ? '<div class="rdw-dh-act" id="rdwSaveBar">' + saveBarHTML(dirty, n) + "</div>" : "") +
      "</div>" +
      stepperHTML(r, ed);
  }
  function saveBarHTML(dirty, n) {
    return (dirty ? '<span class="rdw-chg">' + esc(tr("rdw.nChanges", { n: n })) + "</span>" +
      '<button type="button" class="btn-ghost rdw-btn-sm" data-act="discard">' + esc(tr("rdw.discard")) + "</button>" : "") +
      '<button type="button" class="btn-primary rdw-btn-sm" data-act="save"' + (dirty ? "" : " disabled") + ">" + esc(tr("rdw.save")) + "</button>";
  }
  function refreshSaveBar() {
    var r = view(ST.sel); var bar = document.getElementById("rdwSaveBar"); if (!r || !bar) return;
    var dirty = isDirty(r.code), html = saveBarHTML(dirty, dirty ? Object.keys(ST.drafts[r.code]).length : 0);
    if (bar.innerHTML !== html) bar.innerHTML = html;
  }

  function stepperHTML(r, ed) {
    var lin = linearStages(), susp = r.stage === "SUSPENDED", idx = lin.indexOf(r.stage);
    var steps = lin.map(function (s, i) {
      var st = susp ? "" : i < idx ? "is-past" : i === idx ? "is-cur" : "";
      return '<li class="rdw-step ' + st + (s === "COMPLETED" ? " is-final" : "") + '">' +
        '<button type="button" data-act="stage" data-v="' + s + '"' + (ed ? "" : " disabled") + (i === idx && !susp ? ' aria-current="step"' : "") +
          ' title="' + esc(stageLabel(s) + " · " + prob(s) + "%") + '">' +
          '<span class="rdw-step-dot">' + (i < idx && !susp ? I.check : (i + 1)) + "</span>" +
          '<span class="rdw-step-l">' + esc(stageLabel(s)) + "</span></button></li>";
    }).join("");
    var sBtn = ed
      ? '<button type="button" class="rdw-susp' + (susp ? " on" : "") + '" data-act="suspend" aria-pressed="' + susp + '">' + I.pause +
        "<span>" + esc(susp ? tr("rdw.resume") : tr("rdw.suspend")) + "</span></button>"
      : (susp ? '<span class="rdw-susp on">' + I.pause + "<span>" + esc(tr("rd.pipeline.SUSPENDED")) + "</span></span>" : "");
    return '<div class="rdw-stepper' + (susp ? " is-susp" : "") + '"><ol aria-label="' + esc(tr("rdw.stageAria")) + '">' + steps + "</ol>" + sBtn + "</div>";
  }

  function field(label, body, cls) {
    return '<div class="rdw-f' + (cls ? " " + cls : "") + '"><dt>' + esc(label) + "</dt><dd>" + body + "</dd></div>";
  }
  function inputF(r, ed, key, type, ph) {
    var v = r[key] == null ? "" : r[key];
    if (!ed) return type === "date" ? esc(dmy(v) || "—") : esc(v || "—");
    return '<input class="rdw-in" type="' + (type || "text") + '" data-act="field" data-f="' + key + '" value="' + esc(v) + '"' +
      (ph ? ' placeholder="' + esc(ph) + '"' : "") + ">";
  }
  function rndUsers() {
    var u = (typeof USERS !== "undefined" ? USERS : []).filter(function (x) { return x.role === "rnd" && x.pic; });
    return u.map(function (x) { return x.pic; });
  }
  function picSelect(r, ed) {
    if (!ed || !canAssign()) return picTag(r.pic);
    var opts = rndUsers(); if (r.pic && opts.indexOf(r.pic) < 0) opts.unshift(r.pic);
    return '<select class="rdw-in" data-act="field" data-f="pic"><option value="">' + esc(tr("rdw.m.picNone")) + "</option>" +
      opts.map(function (p) { return '<option value="' + esc(p) + '"' + (p === r.pic ? " selected" : "") + ">" + esc(pl(p)) + "</option>"; }).join("") + "</select>";
  }
  function segSelect(r) {
    var t = segTree();
    return '<select class="rdw-in" data-act="field" data-f="segment"><option value="">—</option>' +
      Object.keys(t).map(function (g) {
        return '<optgroup label="' + esc(g) + '">' + (t[g] || []).map(function (s) {
          return '<option value="' + esc(s) + '"' + (s === r.segment ? " selected" : "") + ">" + esc(s) + "</option>";
        }).join("") + "</optgroup>";
      }).join("") + "</select>";
  }
  function originHTML(r) {
    if (r.type !== "ON_DEMAND" || !r.originProjectId) return '<span class="rdw-mute">' + esc(tr("rdw.noOrigin")) + "</span>";
    var o = origin(r), u = meNow();
    var visible = o && u && typeof scopeRecords === "function" && scopeRecords([o], u).length;
    if (!visible) return '<span class="rdw-mute">' + esc(tr("rdw.originMissing", { id: r.originProjectId })) + "</span>";
    var href = typeof salesFunnelUrl === "function" ? salesFunnelUrl({ open: o.id, ncc: "", status: "", q: "" }) : "salesfunnel.html";
    var stg = o.stage ? '<span class="rdw-mute"> · ' + esc(o.stage) + "</span>" : "";
    return '<a class="rdw-olink" href="' + esc(href) + '" title="' + esc(tr("rdw.openInFunnel")) + '"><b>' + esc(o.id) + "</b> " +
      esc([o.customer, o.product].filter(Boolean).join(" · ")) + " " + I.ext + "</a>" + stg;
  }

  function block1HTML(r, ed) {
    var inh = r.type === "ON_DEMAND";        // ON_DEMAND: kế thừa từ dự án Sales → chỉ đọc
    var edSpec = ed && !inh;
    return '<div class="rdw-card-h"><h4 id="rdwB1">' + esc(tr("rdw.b1")) + "</h4>" +
        (inh ? '<span class="rdw-hint">' + esc(tr("rdw.inherited")) + "</span>" : "") + "</div>" +
      '<dl class="rdw-fields">' +
        field(tr("rdw.fld.application"), inputF(r, edSpec, "application")) +
        field(tr("rdw.fld.product"), inputF(r, edSpec, "product")) +
        field(tr("rdw.fld.ncc"), edSpec ? nccSelectField(r) : esc(r.ncc || "—")) +
        field(tr("rdw.fld.segment"), edSpec ? segSelect(r) : esc(r.segment ? r.segment + (groupOf(r.segment) !== OTHER ? " · " + groupOf(r.segment) : "") : "—")) +
        field(tr("rdw.fld.customer"), esc(r.customer || "—")) +
        field(tr("rdw.fld.origin"), originHTML(r), "is-wide") +
        field(tr("rdw.fld.pic"), picSelect(r, ed)) +
        field(tr("rdw.fld.collab"), (r.collaborators || []).length ? (r.collaborators || []).map(picTag).join(" ") : "—") +
        field(tr("rdw.fld.created"), esc(dmy(r.created) || "—")) +
        field(tr("rdw.fld.target"), inputF(r, ed, "targetDate", "date")) +
        (r.completedDate ? field(tr("rdw.fld.completed"), esc(dmy(r.completedDate))) : "") +
      "</dl>" +
      '<div class="rdw-bench"><label for="rdwBench">' + esc(tr("rd.benchmark")) + "</label>" +
        (ed ? '<textarea id="rdwBench" class="rdw-ta" rows="3" data-act="field" data-f="benchmarkCriteria" placeholder="' + esc(tr("rdw.benchPh")) + '">' + esc(r.benchmarkCriteria || "") + "</textarea>"
            : '<div class="rdw-ro-text">' + esc(r.benchmarkCriteria || "—") + "</div>") +
      "</div>" +
      '<div class="rdw-bench"><label for="rdwDesc">' + esc(tr("rdw.fld.desc")) + "</label>" +
        (ed ? '<textarea id="rdwDesc" class="rdw-ta" rows="2" data-act="field" data-f="desc">' + esc(r.desc || "") + "</textarea>"
            : '<div class="rdw-ro-text">' + esc(r.desc || "—") + "</div>") +
      "</div>";
  }
  function nccSelectField(r) {
    var opts = typeof supplierOptions === "function" ? supplierOptions() : nccCols();
    if (r.ncc && opts.indexOf(r.ncc) < 0) opts = [r.ncc].concat(opts);
    return '<select class="rdw-in" data-act="field" data-f="ncc">' + opts.map(function (n) {
      return '<option value="' + esc(n) + '"' + (n === r.ncc ? " selected" : "") + ">" + esc(n) + "</option>";
    }).join("") + "</select>";
  }

  /* ───────────── Khối 2: mẻ thử Lab ───────────── */
  var RES = ["PASS", "FAIL", "PENDING"];
  function block2HTML(r, ed) {
    var bs = (recOf(r.code).batches || []).slice().sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
    var pass = bs.filter(function (b) { return b.result === "PASS"; }).length;
    var rows = bs.map(function (b) {
      var res = RES.indexOf(b.result) >= 0 ? b.result : "PENDING";
      return "<tr>" +
        '<td class="c-no">#' + esc(b.no) + "</td>" +
        "<td>" + esc(dmy(b.date)) + "</td>" +
        "<td>" + esc(b.ratio || "—") + "</td>" +
        "<td>" + esc(b.temp || "—") + "</td>" +
        "<td>" + esc(b.time || "—") + "</td>" +
        '<td><span class="rdw-res is-' + res.toLowerCase() + '">' + esc(tr("rdw.res." + res)) + "</span></td>" +
        '<td class="c-note">' + esc(b.note || "") + (b.by ? '<small>' + esc(pl(b.by)) + "</small>" : "") + "</td>" +
        '<td class="c-act">' + (ed ? '<button type="button" class="rdw-icon" data-act="delBatch" data-id="' + esc(b.id) + '" aria-label="' + esc(tr("rdw.bt.del") + " #" + b.no) + '" title="' + esc(tr("rdw.bt.del")) + '">' + I.trash + "</button>" : "") + "</td>" +
      "</tr>";
    }).join("");
    var nextNo = bs.reduce(function (m, b) { return Math.max(m, +b.no || 0); }, 0) + 1;
    var form = ed ? '<div class="rdw-bt-form" role="group" aria-label="' + esc(tr("rdw.bt.add")) + '">' +
        '<span class="rdw-bt-no">#' + nextNo + "</span>" +
        '<label><span>' + esc(tr("rdw.bt.date")) + '</span><input class="rdw-in" type="date" id="rdwBtDate" value="' + today() + '"></label>' +
        '<label><span>' + esc(tr("rdw.bt.ratio")) + '</span><input class="rdw-in" id="rdwBtRatio" placeholder="' + esc(tr("rdw.bt.ratioPh")) + '"></label>' +
        '<label><span>' + esc(tr("rdw.bt.temp")) + '</span><input class="rdw-in" id="rdwBtTemp" placeholder="' + esc(tr("rdw.bt.tempPh")) + '"></label>' +
        '<label><span>' + esc(tr("rdw.bt.time")) + '</span><input class="rdw-in" id="rdwBtTime" placeholder="' + esc(tr("rdw.bt.timePh")) + '"></label>' +
        '<label><span>' + esc(tr("rdw.bt.result")) + '</span><select class="rdw-in" id="rdwBtRes">' +
          RES.map(function (x) { return '<option value="' + x + '"' + (x === "PENDING" ? " selected" : "") + ">" + esc(tr("rdw.res." + x)) + "</option>"; }).join("") + "</select></label>" +
        '<label class="is-note"><span>' + esc(tr("rdw.bt.note")) + '</span><input class="rdw-in" id="rdwBtNote" placeholder="' + esc(tr("rdw.bt.notePh")) + '"></label>' +
        '<button type="button" class="btn-primary rdw-btn-sm" data-act="addBatch">' + I.plus + "<span>" + esc(tr("rdw.bt.add")) + "</span></button>" +
      "</div>" : "";
    return '<div class="rdw-card-h"><h4 id="rdwB2">' + esc(tr("rdw.b2")) + "</h4>" +
        (bs.length ? '<span class="rdw-hint">' + esc(tr("rdw.b2sum", { n: bs.length, p: pass })) + "</span>" : "") + "</div>" +
      '<div class="rdw-tbl-wrap"><table class="rdw-tbl"><colgroup><col class="w-no"><col class="w-date"><col><col class="w-num"><col class="w-num"><col class="w-res"><col><col class="w-act"></colgroup><thead><tr>' +
        "<th>" + esc(tr("rdw.bt.no")) + "</th><th>" + esc(tr("rdw.bt.date")) + "</th><th>" + esc(tr("rdw.bt.ratio")) + "</th><th>" +
        esc(tr("rdw.bt.temp")) + "</th><th>" + esc(tr("rdw.bt.time")) + "</th><th>" + esc(tr("rdw.bt.result")) + "</th><th>" +
        esc(tr("rdw.bt.note")) + '</th><th class="c-act"><span class="rdw-sr">' + esc(tr("common.actions")) + "</span></th></tr></thead>" +
        "<tbody>" + (rows || '<tr><td colspan="8" class="rdw-mute rdw-td-empty">' + esc(tr(ed ? "rdw.bt.empty" : "rdw.bt.none")) + "</td></tr>") + "</tbody></table></div>" +
      form +
      '<div class="rdw-bt-msg" id="rdwBtMsg" role="status" aria-live="polite"></div>';
  }

  /* ───────────── Khối 3: tài liệu + hoạt động ───────────── */
  function uploadAllowed(r) { return isDemo() || !!r.spId; }
  function attNoteHTML(r) {
    if (!window.FISG_ATTACH || uploadAllowed(r)) return "";
    return '<p class="rdw-att-note">' + I.cloudOff + esc(tr("rdw.attLocked")) + "</p>";
  }
  function mountAttachments(r, ed) {
    if (!window.FISG_ATTACH) return;
    var o = origin(r);
    var oKey = o && FISG_ATTACH.projectKey ? FISG_ATTACH.projectKey(o) : "";
    FISG_ATTACH.mount(ATT_HOST, {
      type: "rnd", id: r.code,
      ctx: { ncc: r.ncc || "", customer: r.customer || "", code: r.code, pic: r.pic || "" },
      canUpload: ed && uploadAllowed(r),
      categories: true, showFolder: true,
      title: tr("rdw.b3att"),
      extra: function () {
        if (!oKey) return [];
        return FISG_ATTACH.list("project", oKey).map(function (a) { return Object.assign({}, a, { src: o.id }); });
      }
    });
    /* Mặc định loại tài liệu R&D là "Công thức" khi tải lên */
    if (FISG_ATTACH.setCat && ed && uploadAllowed(r)) { FISG_ATTACH.setCat(ATT_HOST, "FORMULA"); FISG_ATTACH.render(ATT_HOST); }
  }

  /* Hoạt động của đề tài: gắn trực tiếp (rdProjectId) HOẶC thuộc dự án Sales gốc */
  function relatedActs(r) {
    if (typeof ACTIVITIES === "undefined") return [];
    var u = meNow();
    var base = ACTIVITIES.filter(function (a) { return a.rdProjectId === r.code || (r.originProjectId && a.projectId === r.originProjectId); });
    if (u && typeof scopeActs === "function" && typeof scopeRecords === "function" && typeof RECORDS !== "undefined")
      base = scopeActs(base, u, scopeRecords(RECORDS, u));
    return base.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
  }
  function actsHTML(r) {
    var acts = relatedActs(r), MAX = 5;
    var head = '<div class="rdw-card-h"><h4 id="rdwB3">' + esc(tr("rdw.b3acts")) + "</h4>" +
      (acts.length ? '<span class="rdw-n">' + acts.length + "</span>" : "") + "</div>";
    /* Ghi hoạt động kỹ thuật (Lab Trial / Joint Visit / Sensory Test) — cần khách hàng nên chỉ cho đề tài theo dự án Sales */
    var logBtn = r.type === "ON_DEMAND" && r.customer && canLogAct(r) && typeof openActForm === "function"
      ? '<button type="button" class="btn-ghost rdw-btn-sm rdw-log-act" data-act="logAct">' + I.plus + "<span>" + esc(tr("rdw.acts.log")) + "</span></button>" : "";
    head = head.replace("</div>", logBtn + "</div>");
    if (r.type !== "ON_DEMAND" && !acts.length) return head + '<p class="rdw-mute">' + esc(tr("rdw.acts.internal")) + "</p>";
    if (!acts.length) return head + '<p class="rdw-mute">' + esc(tr("rdw.acts.none", { id: r.originProjectId || "—" })) + "</p>";
    return head + '<ul class="rdw-acts">' + acts.slice(0, MAX).map(function (a) {
      var tl = typeof actTypeLabel === "function" ? actTypeLabel(a.type) : (a.type || "");
      return '<li><button type="button" class="rdw-act" data-act="openAct" data-id="' + esc(a.id) + '">' +
        '<span class="rdw-act-t' + (a.rdProjectId === r.code ? " is-rd" : "") + '">' + esc(tl) + "</span>" +
        '<span class="rdw-act-b"><b>' + esc(dmy(a.date)) + " · " + esc(pl(a.pic)) + "</b><span>" + esc(a.note || "") + "</span></span></button></li>";
    }).join("") + "</ul>" +
      (acts.length > MAX ? '<button type="button" class="rdw-link" data-act="allActs" data-q="' + esc(r.customer || "") + '">' + esc(tr("rdw.acts.all", { n: acts.length })) + "</button>" : "");
  }

  function historyHTML(r) {
    var rec = recOf(r.code), log = (rec.log || []).slice().reverse().slice(0, 8);
    var parts = [];
    if (rec.updatedAt) parts.push(esc(tr("rdw.audit", { d: dmy(rec.updatedAt), p: pl(rec.updatedBy) || "—" })));
    var items = log.map(function (e) {
      var txt = e.kind === "stage" ? tr("rdw.log.stage", { p: pl(e.by), a: stageLabel(e.from), b: stageLabel(e.to) })
        : e.kind === "created" ? tr("rdw.log.created", { p: pl(e.by) }) : String(e.text || "");
      return "<li><time>" + esc(dmy(e.at) + " " + String(e.at || "").slice(11, 16)) + "</time>" + esc(txt) + "</li>";
    }).join("");
    if (!parts.length && !items) return "";
    return '<footer class="rdw-hist">' + (parts.length ? "<p>" + parts.join(" · ") + "</p>" : "") +
      (items ? '<details><summary>' + esc(tr("rdw.log.title")) + "</summary><ul>" + items + "</ul></details>" : "") + "</footer>";
  }

  /* ───────────── MATRIX ───────────── */
  function matrixHTML() {
    var recs = filtered({ ignoreNcc: false });
    var t = segTree(), rows = Object.keys(t);
    var cols = ST.ncc ? [ST.ncc] : nccCols().concat([OTHER]);
    var cell = {}, rowTot = {}, colTot = {}, hasUnmapped = false;
    recs.forEach(function (r) {
      var g = groupOf(r.segment), c = colOf(r);
      if (g === OTHER) hasUnmapped = true;
      var k = g + "|" + c; (cell[k] = cell[k] || []).push(r);
      rowTot[g] = (rowTot[g] || 0) + 1; colTot[c] = (colTot[c] || 0) + 1;
    });
    if (hasUnmapped) rows = rows.concat([OTHER]);
    if (!recs.length) return '<div class="rdw-mx-card"><div class="rdw-empty-s">' + esc(tr(visibleAll().length ? "rdw.noMatch" : "rdw.empty.title")) + "</div></div>";

    var runN = recs.filter(function (r) { return r.status === "IN_PROGRESS"; }).length;
    var doneN = recs.filter(function (r) { return r.status === "DONE"; }).length;
    var head = '<div class="rdw-mx-head"><p>' + esc(tr("rdw.mx.legend")) + '</p><div class="rdw-mx-kpi">' +
      '<span class="k-run">' + esc(tr("rdw.mx.running", { n: runN })) + "</span>" +
      '<span class="k-done">' + I.check + esc(tr("rdw.mx.done", { n: doneN })) + "</span></div></div>";

    var thead = '<thead><tr><th scope="col" class="mx-corner">' + esc(tr("rdw.mx.corner")) + "</th>" +
      cols.map(function (c) { return '<th scope="col">' + esc(c === OTHER ? tr("rdw.other") : c) + '<span class="mx-n">' + (colTot[c] || 0) + "</span></th>"; }).join("") +
      '<th scope="col" class="mx-tot">' + esc(tr("rdw.mx.total")) + "</th></tr></thead>";

    var tbody = "<tbody>" + rows.map(function (g) {
      var subs = g === OTHER ? "" : (t[g] || []).join(" · ");
      return '<tr><th scope="row"><b>' + esc(g === OTHER ? tr("rdw.mx.unmapped") : g) + "</b>" + (subs ? "<small>" + esc(subs) + "</small>" : "") + "</th>" +
        cols.map(function (c) { return cellHTML(cell[g + "|" + c] || []); }).join("") +
        '<td class="mx-tot">' + (rowTot[g] || 0) + "</td></tr>";
    }).join("") + "</tbody>";

    return '<div class="rdw-mx-card">' + head + '<div class="rdw-mx-scroll"><table class="rdw-mx" style="min-width:' + (170 + cols.length * 200 + 72) + 'px" aria-label="' + esc(tr("rdw.view.matrix")) + '">' + thead + tbody + "</table></div></div>";
  }
  function cellHTML(items) {
    if (!items.length) return '<td class="mx-empty"><span aria-hidden="true">—</span></td>';
    var run = items.filter(function (r) { return r.status === "IN_PROGRESS"; }).length;
    var done = items.filter(function (r) { return r.status === "DONE"; }).length;
    var susp = items.length - run - done;
    var cnt = '<div class="mx-cnt">' +
      (run ? '<span class="c-run">' + esc(tr("rdw.mx.running", { n: run })) + "</span>" : "") +
      (done ? '<span class="c-done">' + I.check + esc(tr("rdw.mx.done", { n: done })) + "</span>" : "") +
      (susp ? '<span class="c-susp">' + esc(tr("rdw.mx.susp", { n: susp })) + "</span>" : "") + "</div>";
    var chips = items.slice().sort(sortRecs).map(function (r) {
      var v = view(r.code) || r;
      return '<li><button type="button" class="mx-chip rdw-t-' + stageTone(v.stage) + '" data-act="focus" data-code="' + esc(r.code) + '" title="' +
        esc(v.title + " — " + stageLabel(v.stage)) + '"><span class="mx-chip-top"><b>' + esc(r.code) + "</b>" + typeBadge(v.type) + "</span>" +
        '<span class="mx-chip-t">' + esc(v.title) + "</span>" +
        '<span class="mx-chip-s"><i></i>' + esc(stageLabel(v.stage)) + " · " + prob(v.stage) + "%</span></button></li>";
    }).join("");
    return "<td>" + cnt + '<ul class="mx-list">' + chips + "</ul></td>";
  }

  /* ═══════════════ ACTIONS ═══════════════ */
  function select(code, focusList) {
    if (!code || code === ST.sel) return;
    var prev = ST.sel; ST.sel = code;
    if (prev) refreshItem(prev);
    refreshItem(code);
    renderDetail();
    var d = document.getElementById("rdwDetail"); if (d) d.scrollTop = 0;
    var it = document.getElementById("rdwI-" + code);
    if (it && it.scrollIntoView) it.scrollIntoView({ block: "nearest" });
    if (focusList) { var l = document.getElementById("rdwList"); if (l) l.focus({ preventScroll: true }); }
  }

  function setDraft(code, key, val) {
    var r = recOf(code); if (!r) return;
    var d = ST.drafts[code] || (ST.drafts[code] = {});
    var cur = r[key] == null ? "" : r[key];
    if (JSON.stringify(cur) === JSON.stringify(val == null ? "" : val)) delete d[key]; else d[key] = val;
    if (!Object.keys(d).length) delete ST.drafts[code];
    refreshSaveBar();
    refreshItem(code);
  }

  function setStage(s) {
    var r = recOf(ST.sel); if (!r || !canEdit(r)) return;
    setDraft(r.code, "stage", s);
    var v = view(r.code);
    var d = document.querySelector("#rdwDetail .rdw-stepper");
    if (d) { var tmp = document.createElement("div"); tmp.innerHTML = stepperHTML(v, true); d.replaceWith(tmp.firstChild); }
  }

  /* Mở lại đề tài tạm hoãn → quay về stage ngay trước khi hoãn (theo nhật ký), mặc định BRIEF */
  function resumeStage(r) {
    if (r.stage !== "SUSPENDED") return r.stage;
    var log = (r.log || []).filter(function (e) { return e.kind === "stage" && e.to === "SUSPENDED"; });
    var prev = log.length ? log[log.length - 1].from : "";
    return prev && prev !== "SUSPENDED" && linearStages().indexOf(prev) >= 0 ? prev : "BRIEF";
  }

  function save() {
    var code = ST.sel, r = recOf(code), d = ST.drafts[code];
    if (!r || !d || !canEdit(r)) return;
    if (d.title != null && !String(d.title).trim()) { toastMsg(tr("rdw.err.title")); var ti = document.querySelector(".rdw-title-in"); if (ti) ti.focus(); return; }
    var from = r.stage, fields = Object.keys(d);
    if (d.pic != null && !canAssign()) { delete d.pic; fields = Object.keys(d); }
    Object.keys(d).forEach(function (k) { r[k] = typeof d[k] === "string" ? d[k].trim() : d[k]; });
    if (d.stage && d.stage !== from) {
      r.status = statusOfStage(r.stage);
      r.completedDate = r.stage === "COMPLETED" ? (r.completedDate || today()) : null;
      (r.log = r.log || []).push({ at: nowStamp(), by: who(), kind: "stage", from: from, to: r.stage });
      fields = fields.concat(["status", "completedDate", "log"]);
    }
    r.updatedAt = today(); r.updatedBy = who();
    delete ST.drafts[code];
    var to = r.stage;
    renderSub(); renderBody();
    persist(r, fields).then(function () {
      toastMsg(tr("rdw.saved", { c: r.code }));
      if (from !== to && window.RND) RND.onStageSaved(r, from, to);
      refreshSync(r);
    }, function (e) { persistFail(e); refreshSync(r); });
  }
  function discard() { delete ST.drafts[ST.sel]; renderBody(); }

  function addBatch() {
    var r = recOf(ST.sel); if (!r || !canEdit(r)) return;
    var g = function (id) { var e = document.getElementById(id); return e ? String(e.value || "").trim() : ""; };
    var b = { date: g("rdwBtDate") || today(), ratio: g("rdwBtRatio"), temp: g("rdwBtTemp"), time: g("rdwBtTime"), result: g("rdwBtRes") || "PENDING", note: g("rdwBtNote") };
    if (!b.ratio && !b.note && !b.temp && !b.time) {
      var m = document.getElementById("rdwBtMsg"); if (m) { m.className = "rdw-bt-msg err"; m.textContent = tr("rdw.bt.need"); }
      var f = document.getElementById("rdwBtRatio"); if (f) f.focus();
      return;
    }
    r.batches = r.batches || [];
    b.no = r.batches.reduce(function (mx, x) { return Math.max(mx, +x.no || 0); }, 0) + 1;
    b.id = "B" + Date.now().toString(36); b.by = who(); b.at = nowStamp();
    r.batches.push(b);
    r.updatedAt = today(); r.updatedBy = who();
    persist(r, ["batches"]).then(function () {
      if (window.RND) RND.onBatchLogged(r, b);
      refreshBatches(r); refreshSync(r);
    }, function (e) { persistFail(e); refreshSync(r); });
    var w = document.getElementById("rdwB2wrap"); if (w) w.innerHTML = block2HTML(view(r.code), true);
    var msg = document.getElementById("rdwBtMsg"); if (msg) { msg.className = "rdw-bt-msg ok"; msg.textContent = tr("rdw.bt.added", { n: b.no }); }
    var nr = document.getElementById("rdwBtRatio"); if (nr) nr.focus();
  }
  function delBatch(id) {
    var r = recOf(ST.sel); if (!r || !canEdit(r)) return;
    var b = (r.batches || []).filter(function (x) { return x.id === id; })[0]; if (!b) return;
    if (typeof confirm === "function" && !confirm(tr("rdw.bt.confirmDel", { n: b.no }))) return;
    r.batches = r.batches.filter(function (x) { return x.id !== id; });
    r.updatedAt = today(); r.updatedBy = who();
    persist(r, ["batches"], { removedBatchIds: [id] }).then(function () { refreshBatches(r); refreshSync(r); },
      function (e) { persistFail(e); refreshSync(r); });
    var w = document.getElementById("rdwB2wrap"); if (w) w.innerHTML = block2HTML(view(r.code), true);
  }

  function focus(code) {
    var r = recOf(code); if (!r) return;
    ST.mode = "split";
    /* Bỏ bộ lọc đang che đề tài được chọn */
    if (!filtered().some(function (x) { return x.code === code; })) { ST.type = "ALL"; ST.ncc = ""; ST.q = ""; }
    ST.sel = code;
    renderSub(); renderBody();
    var it = document.getElementById("rdwI-" + code);
    if (it && it.scrollIntoView) it.scrollIntoView({ block: "center" });
  }

  /* ───────────── Event delegation ───────────── */
  function bind(el) {
    if (el.__rdwBound) return;
    el.__rdwBound = true;
    el.addEventListener("click", function (e) {
      var t = e.target.closest("[data-act]"); if (!t || !el.contains(t)) return;
      var a = t.getAttribute("data-act"), v = t.getAttribute("data-v");
      if (a === "mode") { ST.mode = v; renderSub(); renderBody(); fit(); }
      else if (a === "type") { ST.type = v; renderSub(); renderBody(); }
      else if (a === "clear") { ST.type = "ALL"; ST.ncc = ""; ST.q = ""; renderSub(); renderBody(); }
      else if (a === "select") select(t.getAttribute("data-code"));
      else if (a === "focus") focus(t.getAttribute("data-code"));
      else if (a === "stage") setStage(v);
      else if (a === "suspend") { var r = view(ST.sel); if (r) setStage(r.stage === "SUSPENDED" ? resumeStage(recOf(ST.sel)) : "SUSPENDED"); }
      else if (a === "save") save();
      else if (a === "discard") discard();
      else if (a === "addBatch") addBatch();
      else if (a === "delBatch") delBatch(t.getAttribute("data-id"));
      else if (a === "create") openCreate();
      else if (a === "openAct") openAct(t.getAttribute("data-id"));
      else if (a === "allActs") openAllActs(t.getAttribute("data-q"));
      else if (a === "logAct") logAct();
      else if (a === "retrySync") retrySync();
    });
    el.addEventListener("input", function (e) {
      var t = e.target;
      if (t.getAttribute("data-act") === "q") { ST.q = t.value; renderSubCounts(); renderBody(); return; }
      if (t.getAttribute("data-act") === "field" && t.tagName !== "SELECT") {
        if (t.classList.contains("rdw-title-in")) { t.value = t.value.replace(/\n+/g, " "); autosize(t); }
        setDraft(ST.sel, t.getAttribute("data-f"), t.value);
      }
    });
    el.addEventListener("change", function (e) {
      var t = e.target;
      if (t.getAttribute("data-act") === "ncc") { ST.ncc = t.value; renderSub(); renderBody(); return; }
      /* Ô nhập đã cập nhật nháp qua sự kiện "input"; "change" (bắn khi rời ô, tức lúc nhấn chuột vào nút Lưu)
         chỉ xử lý <select> — tránh dựng lại thanh Lưu giữa mousedown/mouseup làm mất cú bấm. */
      if (t.getAttribute("data-act") === "field" && t.tagName === "SELECT") setDraft(ST.sel, t.getAttribute("data-f"), t.value);
    });
    el.addEventListener("keydown", function (e) {
      if (e.target.id === "rdwList" && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        var codes = filtered().map(function (r) { return r.code; }), i = codes.indexOf(ST.sel);
        var n = e.key === "ArrowDown" ? Math.min(codes.length - 1, i + 1) : Math.max(0, i - 1);
        if (codes[n]) select(codes[n], true);
      }
      if (e.key === "Enter" && e.target.classList && e.target.classList.contains("rdw-title-in")) { e.preventDefault(); e.target.blur(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && ST.mode === "split" && isDirty(ST.sel)) { e.preventDefault(); save(); }
      if (e.key === "Enter" && e.target.closest && e.target.closest(".rdw-bt-form") && e.target.tagName === "INPUT") { e.preventDefault(); addBatch(); }
    });
  }
  function renderSubCounts() {
    /* Gõ tìm kiếm: chỉ cập nhật số đếm trên tab, không dựng lại ô input */
    var base = filtered({ ignoreType: true }), cnt = { ALL: base.length, ON_DEMAND: 0, INTERNAL: 0 };
    base.forEach(function (r) { if (cnt[r.type] != null) cnt[r.type]++; });
    document.querySelectorAll("#rdwSub .rdw-tab").forEach(function (b) { var n = b.querySelector(".rdw-tab-n"); if (n) n.textContent = cnt[b.getAttribute("data-v")]; });
  }

  function openAct(id) {
    if (typeof go === "function") go("acts");
    setTimeout(function () { if (typeof openActivityModal === "function") openActivityModal(id); }, 30);
  }
  function openAllActs(q) {
    if (typeof go === "function") go("acts");
    var inp = document.getElementById("actSearch");
    if (inp && q) { inp.value = q; if (typeof setActSearch === "function") setActSearch(q); }
  }

  /* Split view chiếm đúng phần còn lại của màn hình → từng panel cuộn riêng */
  function fit() {
    var el = root(); if (!el || el.style.display === "none") return;
    var body = document.getElementById("rdwBody"); if (!body) return;
    var top = body.getBoundingClientRect().top + window.scrollY;
    var h = Math.max(480, window.innerHeight - top - 16);
    body.style.setProperty("--rdw-h", h + "px");
  }
  window.addEventListener("resize", function () { fit(); });

  /* ═══════════════ MODAL: TẠO ĐỀ TÀI ═══════════════ */
  var M = { type: "ON_DEMAND", origin: "" };
  function openRecords() {
    var u = meNow(); if (!u || typeof RECORDS === "undefined") return [];
    var base = typeof scopeRecords === "function" ? scopeRecords(RECORDS, u) : RECORDS.slice();
    return base.filter(function (r) { return r.status === "IN PROGRESS"; })
      .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
  }
  function ensureModal() {
    var ov = document.getElementById("rdwModalOv");
    if (ov) return ov;
    ov = document.createElement("div");
    ov.id = "rdwModalOv"; ov.className = "overlay rdw-ov";
    ov.setAttribute("aria-hidden", "true");
    ov.innerHTML = '<div class="modal rdw-modal" role="dialog" aria-modal="true" aria-labelledby="rdwMTitle" tabindex="-1" id="rdwModal"></div>';
    document.body.appendChild(ov);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) closeCreate(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && ov.classList.contains("open")) { e.stopPropagation(); closeCreate(); }
    });
    ov.addEventListener("click", function (e) {
      var t = e.target.closest("[data-m]"); if (!t) return;
      var a = t.getAttribute("data-m");
      if (a === "type") { M.type = t.getAttribute("data-v") === "INTERNAL" && canCreateInternal() ? "INTERNAL" : "ON_DEMAND"; drawModal(); }
      else if (a === "close") closeCreate();
      else if (a === "submit") submitCreate();
    });
    ov.addEventListener("change", function (e) {
      if (e.target.id === "rdwMOrigin") {
        M.origin = e.target.value; drawModal(true);
        var s2 = document.getElementById("rdwMOrigin"); if (s2) s2.focus();   /* giữ focus sau khi vẽ lại */
      }
    });
    return ov;
  }
  function openCreate() {
    if (!canCreate()) return;
    var ov = ensureModal();
    M = { type: "ON_DEMAND", origin: "", ret: document.activeElement };
    drawModal();
    ov.classList.add("open"); ov.setAttribute("aria-hidden", "false");
    setTimeout(function () { var f = ov.querySelector("select,input"); if (f) f.focus(); }, 20);
  }
  function closeCreate() {
    var ov = document.getElementById("rdwModalOv"); if (!ov) return;
    ov.classList.remove("open"); ov.setAttribute("aria-hidden", "true");
    if (M.ret && M.ret.focus) try { M.ret.focus(); } catch (e) {}
  }
  function mval(id) { var e = document.getElementById(id); return e ? String(e.value || "").trim() : ""; }

  function drawModal(keep) {
    var box = document.getElementById("rdwModal"); if (!box) return;
    var saved = keep ? { title: mval("rdwMTitleIn"), pic: mval("rdwMPic"), target: mval("rdwMTarget"), bench: mval("rdwMBench") } : {};
    var u = meNow(), picDef = saved.pic || (u && u.role === "rnd" ? u.pic : (rndUsers()[0] || ""));
    var picOpts = rndUsers(); if (picDef && picOpts.indexOf(picDef) < 0) picOpts.unshift(picDef);
    var od = M.type === "ON_DEMAND";
    var body = "";
    if (od) {
      var recs = openRecords();
      var o = recs.filter(function (r) { return r.id === M.origin; })[0];
      var dup = o ? list().filter(function (x) { return x.originProjectId === o.id && x.status === "IN_PROGRESS"; })[0] : null;
      body += '<div class="rdw-mf is-wide"><label for="rdwMOrigin">' + esc(tr("rdw.m.origin")) + ' <i class="req">*</i></label>' +
        (recs.length
          ? '<select id="rdwMOrigin" class="rdw-in"><option value="">' + esc(tr("rdw.m.originPh")) + "</option>" + recs.map(function (r) {
              return '<option value="' + esc(r.id) + '"' + (r.id === M.origin ? " selected" : "") + ">" + esc(r.id + " · " + r.customer + " · " + (r.product || "") + " (" + r.ncc + ")") + "</option>";
            }).join("") + "</select>"
          : '<p class="rdw-mute">' + esc(tr("rdw.m.noOpen")) + "</p>") + "</div>";
      if (o) {
        body += '<div class="rdw-inh is-wide"><span class="rdw-hint">' + esc(tr("rdw.inherited")) + "</span><div>" +
          [[tr("rdw.fld.customer"), o.customer], [tr("rdw.fld.ncc"), o.ncc], [tr("rdw.fld.product"), o.product], [tr("rdw.fld.application"), o.application], [tr("rdw.fld.segment"), o.segment]]
            .map(function (x) { return '<span class="rdw-badge"><small>' + esc(x[0]) + "</small>" + esc(x[1] || "—") + "</span>"; }).join("") + "</div>" +
          (dup ? '<p class="rdw-warn">' + esc(tr("rdw.m.dup", { c: dup.code })) + "</p>" : "") + "</div>";
      }
    } else {
      var nccs = typeof supplierOptions === "function" ? supplierOptions() : nccCols();
      var t = segTree();
      body += '<div class="rdw-mf"><label for="rdwMNcc">' + esc(tr("rdw.fld.ncc")) + ' <i class="req">*</i></label><select id="rdwMNcc" class="rdw-in"><option value="">' + esc(tr("rdw.m.nccPh")) + "</option>" +
          nccs.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + "</option>"; }).join("") + "</select></div>" +
        '<div class="rdw-mf"><label for="rdwMSeg">' + esc(tr("rdw.fld.segment")) + ' <i class="req">*</i></label><select id="rdwMSeg" class="rdw-in"><option value="">' + esc(tr("rdw.m.segPh")) + "</option>" +
          Object.keys(t).map(function (g) { return '<optgroup label="' + esc(g) + '">' + (t[g] || []).map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + "</option>"; }).join("") + "</optgroup>"; }).join("") + "</select></div>" +
        '<div class="rdw-mf"><label for="rdwMProd">' + esc(tr("rdw.fld.product")) + '</label><input id="rdwMProd" class="rdw-in" list="rdwMProdList" placeholder="' + esc(tr("rdw.m.productPh")) + '">' +
          '<datalist id="rdwMProdList">' + ((typeof LISTS !== "undefined" && LISTS.products) || []).slice(0, 400).map(function (p) { return '<option value="' + esc(p) + '">'; }).join("") + "</datalist></div>" +
        '<div class="rdw-mf"><label for="rdwMApp">' + esc(tr("rdw.fld.application")) + ' <i class="req">*</i></label><input id="rdwMApp" class="rdw-in" placeholder="' + esc(tr("rdw.m.appPh")) + '"></div>';
    }
    /* Gợi ý tên từ dự án Sales; nếu người dùng chưa sửa tên gợi ý thì đổi dự án sẽ đổi theo */
    var suggested = saved.title && saved.title !== M.suggested ? saved.title : "";
    M.suggested = "";
    if (!suggested && od) { var oo = openRecords().filter(function (r) { return r.id === M.origin; })[0]; if (oo) suggested = M.suggested = (oo.application || "") + (oo.customer ? " — " + oo.customer : ""); }
    body += '<div class="rdw-mf is-wide"><label for="rdwMTitleIn">' + esc(tr("rdw.titlePh")) + ' <i class="req">*</i></label><input id="rdwMTitleIn" class="rdw-in" maxlength="160" value="' + esc(suggested) + '"></div>' +
      '<div class="rdw-mf"><label for="rdwMPic">' + esc(tr("rdw.fld.pic")) + '</label><select id="rdwMPic" class="rdw-in"><option value="">' + esc(tr("rdw.m.picNone")) + "</option>" +
        picOpts.map(function (p) { return '<option value="' + esc(p) + '"' + (p === picDef ? " selected" : "") + ">" + esc(pl(p)) + "</option>"; }).join("") + "</select></div>" +
      '<div class="rdw-mf"><label for="rdwMTarget">' + esc(tr("rdw.fld.target")) + '</label><input id="rdwMTarget" type="date" class="rdw-in" value="' + esc(saved.target || "") + '"></div>' +
      '<div class="rdw-mf is-wide"><label for="rdwMBench">' + esc(tr("rd.benchmark")) + '</label><textarea id="rdwMBench" class="rdw-ta" rows="3" placeholder="' + esc(tr("rdw.benchPh")) + '">' + esc(saved.bench || "") + "</textarea></div>";

    box.innerHTML =
      '<div class="modal-head"><div><h3 id="rdwMTitle">' + esc(tr("rdw.m.title")) + '</h3><div class="mh-sub"><span class="rdw-mute">' + esc(tr("rdw.m.sub", { c: nextCode() })) + "</span></div></div>" +
        '<button type="button" class="rdw-icon" data-m="close" aria-label="' + esc(tr("common.close")) + '">✕</button></div>' +
      '<div class="rdw-mbody">' +
        '<div class="rdw-mf is-wide"><span class="rdw-mlabel">' + esc(tr("rdw.m.type")) + '</span><div class="rdw-seg rdw-seg-m" role="radiogroup" aria-label="' + esc(tr("rdw.m.type")) + '">' +
          [["ON_DEMAND", tr("rdw.f.onDemand")]].concat(canCreateInternal() ? [["INTERNAL", tr("rdw.f.internal")]] : []).map(function (x) {
            var on = M.type === x[0];
            return '<button type="button" role="radio" aria-checked="' + on + '" class="' + (on ? "on" : "") + '" data-m="type" data-v="' + x[0] + '">' + esc(x[1]) + "</button>";
          }).join("") + "</div></div>" +
        body +
      "</div>" +
      '<div class="modal-foot"><span class="rdw-merr" id="rdwMErr" role="alert"></span>' +
        '<button type="button" class="btn-ghost" data-m="close">' + esc(tr("common.cancel")) + "</button>" +
        '<button type="button" class="btn-primary" data-m="submit">' + esc(tr("rdw.m.create")) + "</button></div>";
  }

  function submitCreate() {
    var err = document.getElementById("rdwMErr");
    var title = mval("rdwMTitleIn");
    var o = { type: M.type, title: title, pic: mval("rdwMPic"), targetDate: mval("rdwMTarget") || null, benchmarkCriteria: mval("rdwMBench") };
    if (M.type === "ON_DEMAND") {
      o.origin = openRecords().filter(function (r) { return r.id === mval("rdwMOrigin"); })[0];
      if (!o.origin || !title) { if (err) err.textContent = tr("rdw.m.required"); return; }
    } else {
      o.ncc = mval("rdwMNcc"); o.segment = mval("rdwMSeg"); o.product = mval("rdwMProd"); o.application = mval("rdwMApp");
      if (!o.ncc || !o.segment || !o.application || !title) { if (err) err.textContent = tr("rdw.m.required"); return; }
    }
    var btn = document.querySelector('#rdwModal [data-m="submit"]'); if (btn) btn.disabled = true;
    /* RND.create: cấp mã, lưu (SharePoint / cục bộ), chia sẻ quyền theo dõi + ghi nhật ký dự án Sales */
    RND.create(o).then(function (rec) {
      closeCreate();
      toastMsg(tr("rdw.m.created", { c: rec.code }));
      ST.mode = "split"; ST.type = "ALL"; ST.ncc = ""; ST.q = ""; ST.sel = rec.code;
      render();
    }, function (e) {
      if (btn) btn.disabled = false;
      if (err) err.textContent = tr("rnd.msg.saveFailed") + " " + (e && (e.message || e));
    });
  }

  /* Ghi hoạt động cho đề tài: mở form Hoạt động với khách hàng / dự án / đề tài điền sẵn */
  function canLogAct(r) { var u = meNow(); return !!(u && u.role !== "guest" && capOf().edit && (canEdit(r) || (r.collaborators || []).some(mine))); }
  function logAct() {
    var r = recOf(ST.sel); if (!r || typeof openActForm !== "function") return;
    var code = r.code;
    openActForm({
      title: tr("rdw.acts.logTitle"), sub: code + " · " + r.title,
      customer: r.customer, ncc: r.ncc, nccs: r.ncc ? [r.ncc] : [],
      projectId: r.originProjectId || "", rdProjectId: code, type: "LAB_TRIAL"
    }, { label: tr("nav.rnd"), restore: function () { if (typeof go === "function") go("rnd"); focus(code); } });
  }

  /* ═══════════════ Vòng đời & deeplink ═══════════════ */
  window.addEventListener("beforeunload", function (e) {
    if (Object.keys(ST.drafts).length) { e.preventDefault(); e.returnValue = tr("rdw.leave"); return e.returnValue; }
  });

  /* index.html?open=rnd&rd=RD-2026-001 → mở R&D Workspace và chọn đề tài */
  (function deeplink() {
    var p; try { p = new URLSearchParams(location.search); } catch (e) { return; }
    if (p.get("open") !== "rnd") return;
    var code = p.get("rd") || "", tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (meNow() && typeof window.go === "function") {
        clearInterval(iv);
        go("rnd");
        if (code) {
          var n = 0, iv2 = setInterval(function () {
            n++;
            if (recOf(code)) { clearInterval(iv2); focus(code); } else if (n > 60) clearInterval(iv2);
          }, 250);
        }
      } else if (tries > 150) clearInterval(iv);
    }, 200);
  })();

  window.RND_WORKSPACE = {
    render: render, focus: focus, openCreate: openCreate, fit: fit,
    state: ST,
    hasDrafts: function () { return Object.keys(ST.drafts).length > 0; },
    /* dùng cho test / phase sau */
    _internals: { filtered: filtered, colOf: colOf, groupOf: groupOf, nextCode: nextCode, canEdit: canEdit, canSee: canSee, statusOfStage: statusOfStage }
  };
})();
