/* ═══════════════════════════════════════════════════════════════════════
   R&D WORKSPACE — Phase 2 (js/views/rnd-workspace.js)
   Chạy trong trang riêng rnd-workspace.html (host #view-rnd), có deeplink — xem mục "Vòng đời & deeplink".
   Hai chế độ trong cùng view #view-rnd:
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
    bound: false,
    mxOpen: {},
    peek: "",             // mã dự án đang xem nhanh trong drawer (Ma trận)           // ô ma trận đang bung "+ Xem thêm"
    limit: 25,            // phân trang danh sách: số dự án đang hiển thị
    sig: ""               // chữ ký bộ lọc → đổi bộ lọc thì về trang đầu
  };
  var PAGE = 25;

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
    chev: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    panel: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
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
  function initialsOf(p) { return String(pl(p)).trim().split(/\s+/).map(function (w) { return w[0]; }).slice(-2).join("").toUpperCase(); }
  function picTag(p) {
    if (!p) return '<span class="rdw-pic is-none">—</span>';
    return '<span class="rdw-pic"><i aria-hidden="true">' + esc(initialsOf(p)) + "</i>" + esc(pl(p)) + "</span>";
  }
  function avatar(p) {   /* 20×20, màu trung tính — dùng trong danh sách */
    if (!p) return "";
    return '<span class="rdw-av" title="' + esc(tr("rdw.fld.pic") + ": " + pl(p)) + '" aria-label="' + esc(tr("rdw.fld.pic") + ": " + pl(p)) + '">' + esc(initialsOf(p)) + "</span>";
  }

  /* ═══════════════ RENDER ═══════════════ */
  function root() { return document.getElementById(HOST); }

  function headSlot() { return document.getElementById("rdwHeadSlot"); }
  function render() {
    var el = root(), slot = headSlot(); if (!el) return;
    if (!meNow()) { el.innerHTML = ""; if (slot) slot.innerHTML = ""; return; }
    ensureMerged();
    bind(el);
    /* Trang riêng: badge đồng bộ + nút tạo nằm ở header 48px (#rdwHeadSlot); nơi khác vẫn dựng topbar trong view */
    if (slot) { slot.innerHTML = createBtnHTML(); syncRing(); }   // trạng thái đồng bộ = viền avatar (không còn badge)
    el.innerHTML =
      '<div class="rdw">' +
        (slot ? "" : topbarHTML()) +
        '<div class="rdw-sub" id="rdwSub">' + subbarHTML() + "</div>" +
        '<div class="rdw-body" id="rdwBody"></div>' +
      "</div>";
    renderBody();
    fit();
  }

  function syncHTML() {
    var mode = window.RND ? RND.mode() : "local";
    return mode === "demo"
      ? '<span class="rdw-sync is-demo">' + esc(tr("rdw.sync.demo")) + "</span>"
      : mode === "sharepoint"
      ? '<span class="rdw-sync is-sp">' + I.check + esc(tr("rdw.sync.sp")) + "</span>"
      : '<span class="rdw-sync" title="' + esc(tr("rdw.sync.localHint")) + '">' + I.cloudOff + esc(tr("rdw.sync.local")) + "</span>";
  }
  /* Trạng thái đồng bộ → viền mảnh quanh avatar (data-sync) + dòng trạng thái trong popover hồ sơ:
     sharepoint (xanh lá) · local = mất kết nối / chưa có list (cam) · demo (xám) · error = có dự án chưa lưu được (đỏ) */
  function syncInfo() {
    var mode = window.RND ? RND.mode() : "local";
    if (mode !== "demo" && list().some(function (r) { return r._syncErr; })) return { key: "error", text: tr("rdw.sync.err") };
    return { key: mode, text: tr(mode === "sharepoint" ? "rdw.sync.sp" : mode === "demo" ? "rdw.sync.demo" : "rdw.sync.local") };
  }
  function syncRing() {
    if (!window.APP_HEADER) return;
    var i = syncInfo(); APP_HEADER.setSync(i.key, i.text);
  }
  function createBtnHTML() {
    return canCreate() ? '<button type="button" class="btn-primary rdw-create" data-act="create">' + I.plus + "<span>" + esc(tr("rdw.create")) + "</span></button>" : "";
  }
  function topbarHTML() {
    return '<div class="topbar rdw-top"><div class="rdw-top-l"><h2>' + esc(tr("nav.rnd")) + "</h2>" + syncHTML() + "</div>" + createBtnHTML() + "</div>";
  }

  function subbarHTML() {
    var cnt = typeCounts();
    var modes = [["split", I.split, tr("rdw.view.split")], ["matrix", I.grid, tr("rdw.view.matrix")]];
    var types = [["ALL", tr("common.all")], ["ON_DEMAND", tr("rdw.f.onDemand")], ["INTERNAL", tr("rdw.f.internal")]];
    var cols = nccCols().concat([OTHER]);
    var nccOpts = '<option value="">' + esc(tr("rdw.nccAll")) + "</option>" + cols.map(function (c) {
      return '<option value="' + esc(c) + '"' + (ST.ncc === c ? " selected" : "") + ">" + esc(c === OTHER ? tr("rdw.other") : c) + "</option>";
    }).join("");
    return (
      '<div class="rdw-tb-l"><div class="rdw-seg" role="tablist" aria-label="' + esc(tr("rdw.viewAria")) + '">' +
        modes.map(function (m) {
          var on = ST.mode === m[0];
          return '<button type="button" role="tab" aria-selected="' + on + '" class="' + (on ? "on" : "") + '" data-act="mode" data-v="' + m[0] + '">' + m[1] + "<span>" + esc(m[2]) + "</span></button>";
        }).join("") +
      "</div>" + (ST.mode === "matrix" ? '<span class="rdw-tb-hint">' + esc(tr("rdw.mx.legend")) + "</span>" : "") + "</div>" +
      '<div class="rdw-tb-r">' +
        /* Ma trận không có cột danh sách → bộ lọc loại dự án nằm trên toolbar, ảnh hưởng cả ma trận */
        '<div class="rdw-fgroup">' +
          '<label class="rdw-search">' + I.search +
            '<input type="search" id="rdwQ" autocomplete="off" value="' + esc(ST.q) + '" placeholder="' + esc(tr("rdw.searchPh")) + '" aria-label="' + esc(tr("rdw.searchPh")) + '" data-act="q"></label>' +
          '<label class="rdw-select"><span class="rdw-sr">' + esc(tr("rdw.fld.ncc")) + "</span>" +
            '<select data-act="ncc" aria-label="' + esc(tr("rdw.fld.ncc")) + '">' + nccOpts + "</select></label>" +
          /* Ma trận không có cột danh sách → lọc loại dự án bằng dropdown gọn trong cùng cụm */
          (ST.mode === "matrix" ? typeSelectHTML(cnt) : "") +
        "</div>" +
      "</div>"
    );
  }
  function typeCounts() {
    var base = filtered({ ignoreType: true }), cnt = { ALL: base.length, ON_DEMAND: 0, INTERNAL: 0 };
    base.forEach(function (r) { if (cnt[r.type] != null) cnt[r.type]++; });
    return cnt;
  }
  function typeSelectHTML(cnt) {
    var opts = [["ALL", tr("common.all")], ["ON_DEMAND", tr("rdw.f.onDemand")], ["INTERNAL", tr("rdw.f.internal")]];
    return '<label class="rdw-select rdw-typesel"><span class="rdw-typesel-l">' + esc(tr("rdw.mx.typeLbl")) + ":</span>" +
      '<select data-act="typeSel" aria-label="' + esc(tr("rdw.mx.typeLbl")) + '">' +
      opts.map(function (o) { return '<option value="' + o[0] + '"' + (ST.type === o[0] ? " selected" : "") + ">" + esc(o[1]) + " (" + cnt[o[0]] + ")</option>"; }).join("") +
      "</select></label>";
  }
  /* Pill lọc loại dự án. short = nhãn gọn cho đầu cột danh sách (340px) */
  function typeTabsHTML(cnt, short) {
    var types = [["ALL", tr("common.all"), tr("common.all")],
      ["ON_DEMAND", tr(short ? "rdw.f.onDemandShort" : "rdw.f.onDemand"), tr("rdw.f.onDemand")],
      ["INTERNAL", tr(short ? "rdw.f.internalShort" : "rdw.f.internal"), tr("rdw.f.internal")]];
    return '<div class="rdw-tabs' + (short ? " is-sm" : "") + '" role="tablist" aria-label="' + esc(tr("rdw.typeAria")) + '">' +
      types.map(function (t) {
        var on = ST.type === t[0];
        return '<button type="button" role="tab" aria-selected="' + on + '" class="rdw-tab' + (on ? " on" : "") + '" data-act="type" data-v="' + t[0] + '" title="' + esc(t[2]) + '">' +
          esc(t[1]) + ' <span class="rdw-tab-n">' + cnt[t[0]] + "</span></button>";
      }).join("") + "</div>";
  }

  function renderSub() { var s = document.getElementById("rdwSub"); if (!s) return; var foc = document.activeElement && document.activeElement.id === "rdwQ"; s.innerHTML = subbarHTML(); if (foc) { var q = document.getElementById("rdwQ"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } }

  function masterHead(recs, shown) {
    var sub = ST.q || ST.ncc || recs.length > shown;
    return typeTabsHTML(typeCounts(), true) +
      (sub ? '<div class="rdw-mmeta"><span>' + esc(recs.length > shown ? tr("rdw.shown", { a: shown, b: recs.length }) : tr("rdw.count", { n: recs.length })) + "</span>" +
        (ST.q || ST.ncc ? '<button type="button" class="rdw-link" data-act="clear">' + esc(tr("act.clearFilters")) + "</button>" : "") + "</div>" : "");
  }
  function masterList(recs, shown) {
    if (!recs.length) return emptyListHTML();
    var rest = recs.length - shown;
    return recs.slice(0, shown).map(itemHTML).join("") +
      (rest > 0 ? '<button type="button" class="rdw-more" data-act="more">' + esc(tr("rdw.more", { n: Math.min(PAGE, rest) })) + "</button>" : "");
  }
  /* Phân trang: hiển thị PAGE dự án, cuộn tới cuối hoặc bấm "Xem thêm" để nạp tiếp */
  function shownCount(recs) {
    var sig = ST.type + "|" + ST.ncc + "|" + ST.q;
    if (sig !== ST.sig) { ST.sig = sig; ST.limit = PAGE; }
    var i = -1; for (var k = 0; k < recs.length; k++) if (recs[k].code === ST.sel) { i = k; break; }
    if (i >= ST.limit) ST.limit = Math.ceil((i + 1) / PAGE) * PAGE;
    return Math.min(ST.limit, recs.length);
  }
  function renderMaster() {
    var l = document.getElementById("rdwList"), h = document.getElementById("rdwMHead"); if (!l || !h) return;
    var recs = filtered(), top = l.scrollTop, n = shownCount(recs);
    h.innerHTML = masterHead(recs, n); l.innerHTML = masterList(recs, n); l.scrollTop = top;
  }
  function loadMore() {
    var recs = filtered(); if (ST.limit >= recs.length) return;
    ST.limit += PAGE; renderMaster();
  }

  function renderBody() {
    var b = document.getElementById("rdwBody"); if (!b) return;
    b.className = "rdw-body is-" + ST.mode;
    if (ST.mode === "matrix") { b.innerHTML = matrixHTML(); syncUrl(); return; }
    var recs = filtered();
    if (!recs.some(function (r) { return r.code === ST.sel; })) ST.sel = recs.length ? recs[0].code : "";
    var n = shownCount(recs);
    b.innerHTML =
      '<div class="rdw-split">' +
        '<aside class="rdw-master" aria-label="' + esc(tr("rdw.listAria")) + '">' +
          '<div class="rdw-mhead" id="rdwMHead">' + masterHead(recs, n) + "</div>" +
          '<div class="rdw-mlist" id="rdwList" role="listbox" tabindex="0" aria-label="' + esc(tr("rdw.listAria")) + '">' + masterList(recs, n) + "</div>" +
        "</aside>" +
        '<section class="rdw-detail" id="rdwDetail" aria-live="polite"></section>' +
      "</div>";
    renderDetail();
    syncUrl();
  }

  function emptyListHTML() {
    var none = !visibleAll().length;
    return '<div class="rdw-empty-s">' + esc(tr(none ? "rdw.emptyList" : "rdw.noMatch")) + "</div>";
  }

  function stageBadge(v) {
    return '<span class="rdw-stg rdw-t-' + stageTone(v.stage) + '">' + esc(stageLabel(v.stage)) +
      (v.stage === "SUSPENDED" ? "" : " · " + prob(v.stage) + "%") + "</span>";
  }
  function itemHTML(r) {
    var v = view(r.code) || r;
    var on = r.code === ST.sel;
    var who2 = [v.customer || tr("rd.type.INTERNAL"), v.ncc].filter(Boolean).map(esc).join(" · ");
    return '<div class="rdw-item' + (on ? " is-active" : "") + (v.status !== "IN_PROGRESS" ? " is-closed" : "") + '" role="option" aria-selected="' + on + '" data-act="select" data-code="' + esc(r.code) + '" id="rdwI-' + esc(r.code) + '">' +
      '<div class="rdw-i-top"><span class="rdw-code">' + esc(r.code) + "</span>" + typeBadge(v.type) +
        (isDirty(r.code) ? '<span class="rdw-dirty" title="' + esc(tr("rdw.unsaved")) + '" aria-label="' + esc(tr("rdw.unsaved")) + '"></span>' : "") +
        (r._syncErr ? '<span class="rdw-dirty is-err" title="' + esc(tr("rds.notSynced")) + '" aria-label="' + esc(tr("rds.notSynced")) + '"></span>' : "") +
      "</div>" +
      '<div class="rdw-i-title">' + esc(v.title || "—") + "</div>" +
      '<div class="rdw-i-who">' + who2 + "</div>" +
      '<div class="rdw-i-foot">' + stageBadge(v) + avatar(v.pic) + "</div>" +
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
      var any = visibleAll().length, fUrl = window.rndFunnelUrl ? rndFunnelUrl() : "salesfunnel.html";
      d.innerHTML = '<div class="rdw-empty">' + I.flask +
        "<h3>" + esc(tr(any ? "rdw.noMatch" : "rdw.empty.title")) + "</h3>" +
        "<p>" + esc(tr(any ? "rdw.noMatchHint" : "rdw.empty.body")) + "</p>" +
        (any ? '<button type="button" class="rdw-link" data-act="clear">' + esc(tr("act.clearFilters")) + "</button>"
             : '<a class="rdw-link" href="' + esc(fUrl) + '">' + esc(tr("rdw.empty.link")) + " →</a>") +
        "</div>";
      return;
    }
    var ed = canEdit(recOf(r.code));
    d.innerHTML =
      '<header class="rdw-dh">' + headHTML(r, ed) + syncErrHTML(recOf(r.code)) + "</header>" +
      '<div class="rdw-dbody">' +
        block1HTML(r, ed) +
        '<section class="rdw-card" aria-labelledby="rdwB2" id="rdwB2wrap">' + block2HTML(r, ed) + "</section>" +
        '<div class="rdw-grid2">' +
          '<section class="rdw-card rdw-att-card"><div id="' + ATT_HOST + '"></div>' + attNoteHTML(r) + "</section>" +
          '<section class="rdw-card" aria-labelledby="rdwB3">' + actsHTML(r) + "</section>" +
        "</div>" +
        historyHTML(r) +
      "</div>";
    mountAttachments(r, ed);
    autosize(d.querySelector(".rdw-title-in"));
    d.querySelectorAll(".rdw-ta").forEach(growTa);
  }
  function autosize(t) { if (!t) return; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
  /* textarea tự giãn theo nội dung (min-height 72px trong CSS; +2 = viền 1px trên/dưới) */
  function growTa(t) { if (!t) return; t.style.height = "auto"; t.style.height = (t.scrollHeight + 2) + "px"; }

  function headHTML(r, ed) {
    var dirty = isDirty(r.code);
    var n = dirty ? Object.keys(ST.drafts[r.code]).length : 0;
    var susp = r.stage === "SUSPENDED";
    var title = ed
      ? '<textarea class="rdw-title-in" rows="1" data-act="field" data-f="title" aria-label="' + esc(tr("rdw.titlePh")) + '" placeholder="' + esc(tr("rdw.titlePh")) + '" maxlength="160">' + esc(r.title) + "</textarea>"
      : '<h3 class="rdw-title-ro">' + esc(r.title) + "</h3>";
    var sBtn = ed
      ? '<button type="button" class="rdw-susp' + (susp ? " on" : "") + '" data-act="suspend" aria-pressed="' + susp + '">' + I.pause +
        "<span>" + esc(susp ? tr("rdw.resume") : tr("rdw.suspend")) + "</span></button>"
      : "";
    return '<div class="rdw-dh-meta"><span class="rdw-code is-lg">' + esc(r.code) + "</span>" + typeBadge(r.type) + statusPill(r.status) +
        (ed ? "" : '<span class="rdw-ro">' + esc(tr("rdw.readOnly")) + "</span>") + "</div>" +
      '<div class="rdw-dh-top"><div class="rdw-dh-main">' + title + "</div>" +
        (ed ? '<div class="rdw-dh-act">' + sBtn + '<span class="rdw-savebar" id="rdwSaveBar">' + saveBarHTML(dirty, n) + "</span></div>" : "") +
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
    if (bar.innerHTML !== html) { bar.innerHTML = html; autosize(document.querySelector("#rdwDetail .rdw-title-in")); }   // cụm nút đổi bề rộng → tiêu đề xuống dòng
  }

  /* Thanh giai đoạn dạng chevron phẳng, cao 32px: đã qua (check) · hiện tại (màu chủ đạo, kèm %) · chưa tới (xám) */
  function stepperHTML(r, ed) {
    var lin = linearStages(), susp = r.stage === "SUSPENDED", idx = lin.indexOf(r.stage);
    var steps = lin.map(function (s, i) {
      var st = susp ? "is-next" : i < idx ? "is-past" : i === idx ? "is-cur" : "is-next";
      var label = esc(stageLabel(s));
      return '<li class="rdw-stage ' + st + (s === "COMPLETED" ? " is-final" : "") + '">' +
        '<button type="button" data-act="stage" data-v="' + s + '"' + (ed ? "" : " disabled") + (i === idx && !susp ? ' aria-current="step"' : "") +
          ' title="' + esc(stageLabel(s) + " · " + prob(s) + "%") + '">' +
          (i < idx && !susp ? I.check : "") + '<span class="rdw-stage-l">' + label + "</span>" +
          (i === idx && !susp ? '<b class="rdw-stage-p">' + prob(s) + "%</b>" : "") +
        "</button></li>";
    }).join("");
    return '<div class="rdw-pipe' + (susp ? " is-susp" : "") + '">' +
      '<ol aria-label="' + esc(tr("rdw.stageAria")) + '">' + steps + "</ol>" +
      (susp ? '<span class="rdw-pipe-susp">' + I.pause + esc(tr("rd.pipeline.SUSPENDED")) + "</span>" : "") +
    "</div>";
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
    var u = (typeof USERS !== "undefined" ? USERS : []).filter(function (x) { return x.pic && (typeof hasRole === "function" ? hasRole(x, "rnd") : x.role === "rnd"); });
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

  /* Chi tiết = 2 khối tách bạch:
     1) Thông tin chỉ đọc (kế thừa từ dự án Sales với ON-DEMAND) — nền xám, cặp nhãn/giá trị
     2) Thiết lập & thực thi R&D — các trường sửa được (R&D phụ trách, hạn, benchmark, ghi chú;
        với INTERNAL thêm ứng dụng / nguyên liệu / NCC / segment) */
  function roF(label, body, cls) {
    return '<div class="rdw-kv' + (cls ? " " + cls : "") + '"><dt>' + esc(label) + "</dt><dd>" + body + "</dd></div>";
  }
  function edF(label, body, id, cls) {
    return '<div class="rdw-ef' + (cls ? " " + cls : "") + '"><label' + (id ? ' for="' + id + '"' : "") + ">" + esc(label) + "</label>" + body + "</div>";
  }
  function peopleText(list) {
    if (!list || !list.length) return "—";
    return list.map(function (p) {
      var u = (typeof USERS !== "undefined") ? USERS.filter(function (x) { return x.pic === p || x.name === p; })[0] : null;
      return esc(pl(p)) + (u && typeof roleLabel === "function" ? ' <span class="rdw-mute">(' + esc(roleLabel(u.role)) + ")</span>" : "");
    }).join(", ");
  }
  function segText(r) { return esc(r.segment ? r.segment + (groupOf(r.segment) !== OTHER ? " · " + groupOf(r.segment) : "") : "—"); }
  function taHTML(id, key, val, ph) {
    return '<textarea id="' + id + '" class="rdw-ta" rows="2" data-act="field" data-f="' + key + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + ">" + esc(val || "") + "</textarea>";
  }
  function block1HTML(r, ed) {
    var inh = r.type === "ON_DEMAND";
    var edSpec = ed && !inh;          // INTERNAL + có quyền sửa → thông số kỹ thuật chuyển sang khối sửa được
    var ro = "";
    if (!edSpec) ro +=
      roF(tr("rdw.fld.application"), esc(r.application || "—")) +
      roF(tr("rdw.fld.product"), esc(r.product || "—")) +
      roF(tr("rdw.fld.ncc"), esc(r.ncc || "—"));
    ro +=
      (inh ? roF(tr("rdw.fld.customer"), esc(r.customer || "—")) : "") +
      (edSpec ? "" : roF(tr("rdw.fld.segment"), segText(r))) +
      roF(tr("rdw.fld.created"), esc(dmy(r.created) || "—")) +
      (inh ? roF(tr("rdw.fld.origin"), originHTML(r), "is-wide") : "") +
      roF(tr("rdw.fld.collab"), peopleText(r.collaborators)) +
      (r.completedDate ? roF(tr("rdw.fld.completed"), esc(dmy(r.completedDate))) : "");

    var form =
      (edSpec
        ? edF(tr("rdw.fld.application"), inputF(r, true, "application")) +
          edF(tr("rdw.fld.product"), inputF(r, true, "product")) +
          edF(tr("rdw.fld.ncc"), nccSelectField(r)) +
          edF(tr("rdw.fld.segment"), segSelect(r))
        : "") +
      edF(tr("rdw.fld.pic"), ed && canAssign() ? picSelect(r, ed) : '<div class="rdw-ro-v">' + picTag(r.pic) + "</div>") +
      edF(tr("rdw.fld.target"), ed ? inputF(r, true, "targetDate", "date") : '<div class="rdw-ro-v">' + esc(dmy(r.targetDate) || "—") + "</div>") +
      edF(tr("rd.benchmark"), ed ? taHTML("rdwBench", "benchmarkCriteria", r.benchmarkCriteria, tr("rdw.benchPh")) : '<div class="rdw-ro-text">' + esc(r.benchmarkCriteria || "—") + "</div>", "rdwBench", "is-wide") +
      edF(tr("rdw.fld.desc"), ed ? taHTML("rdwDesc", "desc", r.desc) : '<div class="rdw-ro-text">' + esc(r.desc || "—") + "</div>", "rdwDesc", "is-wide");

    return '<section class="rdw-card" aria-labelledby="rdwB1">' +
        '<div class="rdw-card-h"><h4 id="rdwB1">' + esc(tr(inh ? "rdw.sec.inherited" : "rdw.sec.info")) + "</h4>" +
          '<span class="rdw-hint">' + esc(tr("rdw.readOnly")) + "</span></div>" +
        '<dl class="rdw-meta">' + ro + "</dl>" +
      "</section>" +
      '<section class="rdw-card" aria-labelledby="rdwB1b">' +
        '<div class="rdw-card-h"><h4 id="rdwB1b">' + esc(tr("rdw.sec.work")) + "</h4></div>" +
        '<div class="rdw-form">' + form + "</div>" +
      "</section>";
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
      cats: ["TEST", "FORMULA", "SENSORY", "OTHER"],   // Kết quả thử mẫu · Công thức · Đánh giá cảm quan · Khác
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
  /* Ma trận ứng dụng: dòng = nhóm ứng dụng (cột trái cố định), cột = nhà cung cấp.
     Cột không có dự án thu hẹp (chỉ hiện badge 0). Mỗi ô là danh sách dòng gọn 30px, tối đa 3 dòng + "Xem thêm". */
  /* Ma trận ứng dụng — công cụ tra cứu cho Sales / R&D / BOD:
     dòng = nhóm ứng dụng (cột trái cố định), cột = nhà cung cấp; cột có dữ liệu tối đa 480px, cột rỗng thu gọn 96px.
     Nền ô theo mật độ: 0 → xám nhạt · 1–2 → trắng · ≥3 → xanh nhạt nếu có công thức chuẩn (vùng tập trung giải pháp).
     Mỗi dự án là 1 dòng 32px; bấm → drawer xem nhanh. Rê vào ô → nút "+" tạo dự án điền sẵn ô đó. */
  var MX_MAX = 3;
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

    var full = cols.filter(function (c) { return colTot[c]; }).length, empty = cols.length - full;
    var colg = '<colgroup><col class="mx-c-row">' + cols.map(function (c) { return '<col class="' + (colTot[c] ? "mx-c-data" : "mx-c-empty") + '">'; }).join("") + '<col class="mx-c-tot"></colgroup>';
    var thead = '<thead><tr><th scope="col" class="mx-corner">' + esc(tr("rdw.mx.corner")) + "</th>" +
      cols.map(function (c) {
        return '<th scope="col"' + (colTot[c] ? "" : ' class="is-empty"') + '><span class="mx-th">' + esc(c === OTHER ? tr("rdw.other") : c) + "</span>" +
          '<span class="mx-n">' + (colTot[c] || 0) + "</span></th>";
      }).join("") +
      '<th scope="col" class="mx-tot">' + esc(tr("rdw.mx.total")) + "</th></tr></thead>";

    var add = canCreate();
    var tbody = "<tbody>" + rows.map(function (g) {
      var subs = g === OTHER ? "" : (t[g] || []).join(" · ");
      return '<tr><th scope="row"><b>' + esc(g === OTHER ? tr("rdw.mx.unmapped") : g) + "</b>" + (subs ? "<small>" + esc(subs) + "</small>" : "") + "</th>" +
        cols.map(function (c) { return cellHTML(cell[g + "|" + c] || [], g, c, !colTot[c], add); }).join("") +
        '<td class="mx-tot">' + (rowTot[g] || 0) + "</td></tr>";
    }).join("") + "</tbody>";

    var minW = 190 + full * 260 + empty * 96 + 64, maxW = 190 + full * 480 + empty * 96 + 64;
    return '<div class="rdw-mx-card"><div class="rdw-mx-scroll"><table class="rdw-mx" style="min-width:' + minW + "px;width:min(100%," + maxW + 'px)" aria-label="' + esc(tr("rdw.view.matrix")) + '">' +
      colg + thead + tbody + "</table></div></div>";
  }
  function mxTone(v) { return v.status === "DONE" ? "done" : v.status === "IN_PROGRESS" ? "run" : "susp"; }
  function mxRowHTML(r) {
    var v = view(r.code) || r, tone = mxTone(v);
    var tag = tone === "done" ? tr("rd.status.DONE") : tone === "susp" ? tr("rdw.suspend") : prob(v.stage) + "%";
    var tip = r.code + " · " + stageLabel(v.stage) + (tone === "run" ? " · " + prob(v.stage) + "%" : "") + " — " + tr("rdw.mx.tipOpen");
    return '<li><button type="button" class="mx-row" data-act="peek" data-code="' + esc(r.code) + '" aria-haspopup="dialog" data-tip="' + esc(tip) + '">' +
      '<i class="mx-dot is-' + tone + '" aria-hidden="true"></i>' +
      '<span class="mx-code">' + esc(r.code.replace(/^RD-\d{4}-/, "")) + "</span>" +
      '<span class="mx-t">' + esc(v.title) + "</span>" +
      '<span class="mx-stg is-' + tone + '">' + esc(tag) + "</span>" +
      '<span class="mx-go" aria-hidden="true">' + I.panel + "</span></button></li>";
  }
  function cellHTML(items, g, c, emptyCol, add) {
    /* Nút "+ Dự án" thuộc về Ô (header góc phải, chỉ hiện khi rê vào ô) — không gắn vào dòng dự án */
    var aria = tr("rdw.mx.addAria", { g: g === OTHER ? tr("rdw.mx.unmapped") : g, n: c === OTHER ? tr("rdw.other") : c });
    var addBtn = add ? '<div class="mx-cell-h"><button type="button" class="mx-add" data-act="mxAdd" data-g="' + esc(g) + '" data-c="' + esc(c) + '" aria-label="' + esc(aria) + '" data-tip="' + esc(aria) + '">' +
      I.plus + (emptyCol ? "" : "<span>" + esc(tr("rdw.mx.addShort")) + "</span>") + "</button></div>" : "";
    if (!items.length) return '<td class="mx-cell mx-empty' + (emptyCol ? " is-col" : "") + (add ? " has-h" : "") + '"><span class="mx-dash" aria-hidden="true">—</span>' + addBtn + "</td>";
    var list = items.slice().sort(sortRecs), open = !!ST.mxOpen[g + "|" + c];
    var shown = open ? list : list.slice(0, MX_MAX), rest = list.length - MX_MAX;
    var dense = list.length >= 3 ? (list.some(function (r) { return r.status === "DONE"; }) ? " is-hot" : " is-dense") : "";
    return '<td class="mx-cell' + dense + (add ? " has-h" : "") + '">' + addBtn + '<ul class="mx-list">' + shown.map(mxRowHTML).join("") + "</ul>" +
      (rest > 0 ? '<button type="button" class="mx-more" data-act="mxMore" data-k="' + esc(g + "|" + c) + '" aria-expanded="' + open + '">' +
        esc(open ? tr("rdw.mx.less") : tr("rdw.mx.more", { n: rest })) + "</button>" : "") +
    "</td>";
  }

  /* Tooltip nhẹ cho [data-tip]: hiện sau 300ms, đặt phía trên phần tử, không chặn chuột (thay title gốc của trình duyệt) */
  var TIP = { el: null, t: 0, cur: null };
  function tipEl() {
    if (!TIP.el) { TIP.el = document.createElement("div"); TIP.el.className = "rdw-tip"; TIP.el.setAttribute("role", "tooltip"); TIP.el.hidden = true; document.body.appendChild(TIP.el); }
    return TIP.el;
  }
  function tipHide() { clearTimeout(TIP.t); TIP.cur = null; if (TIP.el) { TIP.el.classList.remove("on"); TIP.el.hidden = true; } }
  function tipShow(target) {
    var el = tipEl(), r = target.getBoundingClientRect();
    el.textContent = target.getAttribute("data-tip"); el.hidden = false;
    var w = el.offsetWidth, x = Math.min(Math.max(8, r.left + 8), window.innerWidth - w - 8), y = r.top - el.offsetHeight - 6;
    if (y < 4) y = r.bottom + 6;
    el.style.left = x + "px"; el.style.top = y + "px";
    el.classList.add("on");
  }
  function bindTips(host) {
    host.addEventListener("mouseover", function (e) {
      var t = e.target.closest && e.target.closest("[data-tip]");
      if (t === TIP.cur) return;
      tipHide(); if (!t) return;
      TIP.cur = t; TIP.t = setTimeout(function () { if (TIP.cur === t && document.contains(t)) tipShow(t); }, 300);
    });
    host.addEventListener("mouseleave", tipHide);
    host.addEventListener("mousedown", tipHide);
    host.addEventListener("scroll", tipHide, true);
    host.addEventListener("focusin", function (e) { var t = e.target.closest && e.target.closest("[data-tip]"); if (t && t.matches(":focus-visible")) { tipHide(); TIP.cur = t; tipShow(t); } });
    host.addEventListener("focusout", tipHide);
  }

  /* ═══════════════ QUICK PREVIEW DRAWER (Ma trận) ═══════════════ */
  var PK = { ret: null };
  function ensurePeek() {
    var ov = document.getElementById("rdwPeekOv"); if (ov) return ov;
    ov = document.createElement("div");
    ov.id = "rdwPeekOv"; ov.className = "rdw-pk-ov"; ov.hidden = true;
    ov.innerHTML = '<aside class="rdw-pk" id="rdwPeek" role="dialog" aria-modal="true" aria-labelledby="rdwPkTitle" tabindex="-1"></aside>';
    document.body.appendChild(ov);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) closePeek(); });
    ov.addEventListener("click", function (e) {
      var b = e.target.closest("[data-pk]"); if (!b) return;
      var a = b.getAttribute("data-pk");
      if (a === "close") closePeek();
      else if (a === "open") { var c = ST.peek; closePeek(true); focus(c); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !ov.hidden) { e.stopPropagation(); closePeek(); }
      if (e.key === "Tab" && !ov.hidden) {   /* giữ focus trong drawer */
        var f = ov.querySelectorAll("button,select,textarea,a[href],input"); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    return ov;
  }
  function openPeek(code) {
    if (!recOf(code)) return;
    var ov = ensurePeek();
    ST.peek = code; tipHide();
    if (ov.hidden) PK.ret = document.activeElement;
    drawPeek();
    ov.hidden = false;
    requestAnimationFrame(function () { ov.classList.add("open"); var x = ov.querySelector('[data-pk="close"]'); if (x) x.focus(); });
  }
  function closePeek(noRestore) {
    var ov = document.getElementById("rdwPeekOv"); if (!ov || ov.hidden) return;
    ov.classList.remove("open"); ST.peek = "";
    setTimeout(function () { ov.hidden = true; }, 200);
    if (!noRestore && PK.ret && PK.ret.focus && document.contains(PK.ret)) try { PK.ret.focus(); } catch (e) {}
  }
  function bestBatch(r) {
    var bs = (r.batches || []).slice().sort(function (a, b) { return (b.no || 0) - (a.no || 0); });
    return bs.filter(function (b) { return b.result === "PASS"; })[0] || null;
  }
  /* Tình trạng mẫu suy từ dữ liệu có thật (giai đoạn + mẻ thử đạt), không phải số liệu tồn kho mẫu */
  function sampleState(r) {
    var pass = bestBatch(r), lin = linearStages();
    if (r.stage === "COMPLETED") return { tone: "ok", text: tr("rdw.pk.sDone") };
    if (pass) return { tone: "ok", text: tr("rdw.pk.sPass", { n: pass.no, d: dmy(pass.date) }) };
    if (lin.indexOf(r.stage) >= lin.indexOf("SAMPLE_SENT") && r.stage !== "SUSPENDED") return { tone: "mid", text: tr("rdw.pk.sSent") };
    return { tone: "warn", text: tr("rdw.pk.sNone") };
  }
  function drawPeek() {
    var box = document.getElementById("rdwPeek"), r = view(ST.peek); if (!box || !r) return;
    var rec = recOf(r.code), tone = mxTone(r);
    var bs = (rec.batches || []).slice().sort(function (a, b) { return (b.no || 0) - (a.no || 0); });
    var pass = bestBatch(rec), rb = pass || bs[0];
    var ratio = rb && rb.ratio ? esc(rb.ratio) + ' <span class="rdw-mute">' + esc(tr("rdw.pk.ratioFrom", { n: rb.no })) + "</span>" : '<span class="rdw-mute">' + esc(tr("rdw.pk.noRatio")) + "</span>";
    var smp = sampleState(rec);
    var kv = function (l, v, cls) { return '<div class="rdw-kv' + (cls ? " " + cls : "") + '"><dt>' + esc(l) + "</dt><dd>" + v + "</dd></div>"; };
    var batches = bs.slice(0, 3).map(function (b) {
      var res = RES.indexOf(b.result) >= 0 ? b.result : "PENDING";
      return "<li><b>#" + esc(b.no) + "</b><span>" + esc([b.ratio, b.temp, b.time].filter(Boolean).join(" · ") || "—") + "</span>" +
        '<span class="rdw-res is-' + res.toLowerCase() + '">' + esc(tr("rdw.res." + res)) + "</span></li>";
    }).join("");
    box.innerHTML =
      '<header class="rdw-pk-h"><div class="rdw-dh-meta"><span class="rdw-code is-lg">' + esc(r.code) + "</span>" + typeBadge(r.type) + statusPill(r.status) + "</div>" +
        '<button type="button" class="rdw-pk-x" data-pk="close" aria-label="' + esc(tr("common.close")) + '">' + I.x + "</button></header>" +
      '<div class="rdw-pk-b">' +
        '<h2 id="rdwPkTitle" class="rdw-pk-t">' + esc(r.title || "—") + "</h2>" +
        '<p class="rdw-pk-stage"><i class="mx-dot is-' + tone + '"></i>' + esc(tr("rdw.pk.stage")) + ": <b>" + esc(stageLabel(r.stage)) + "</b>" + (tone === "run" ? " · " + prob(r.stage) + "%" : "") + "</p>" +
        '<section class="rdw-pk-sec"><h3>' + esc(tr("rdw.pk.snapshot")) + '</h3><dl class="rdw-pk-kv">' +
          kv(tr("rdw.pk.target"), esc(r.customer || tr("rd.type.INTERNAL"))) +
          kv(tr("rdw.fld.ncc"), esc(r.ncc || "—")) +
          kv(tr("rdw.pk.ingredient"), esc(r.product || "—")) +
          kv(tr("rdw.pk.ratio"), ratio) +
          kv(tr("rdw.fld.application"), esc(r.application || "—") + (r.segment ? ' <span class="rdw-mute">· ' + esc(r.segment) + "</span>" : "")) +
          kv(tr("rdw.fld.pic"), picTag(r.pic)) +
          kv(tr("rdw.pk.sample"), '<span class="rdw-pk-smp is-' + smp.tone + '">' + esc(smp.text) + "</span>", "is-wide") +
          (r.type === "ON_DEMAND" && r.originProjectId ? kv(tr("rdw.fld.origin"), originHTML(r), "is-wide") : "") +
        "</dl></section>" +
        '<section class="rdw-pk-sec"><h3>' + esc(tr("rd.benchmark")) + '</h3><p class="rdw-pk-bench">' + esc(r.benchmarkCriteria || "—") + "</p></section>" +
        (batches ? '<section class="rdw-pk-sec"><h3>' + esc(tr("rdw.pk.batches")) + '</h3><ul class="rdw-pk-bt">' + batches + "</ul></section>" : "") +
      "</div>" +
      '<footer class="rdw-pk-f">' +
        '<button type="button" class="btn-primary" data-pk="open">' + esc(tr("rdw.pk.open")) + " " + I.ext + "</button>" +
      "</footer>";
  }

  /* ═══════════════ ACTIONS ═══════════════ */
  function select(code, focusList) {
    if (!code || code === ST.sel) return;
    var prev = ST.sel; ST.sel = code;
    if (!document.getElementById("rdwI-" + code)) renderMaster();   // mục nằm ngoài trang đang hiển thị (điều hướng bàn phím)
    if (prev) refreshItem(prev);
    refreshItem(code);
    renderDetail();
    syncUrl();
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
    var d = document.querySelector("#rdwDetail .rdw-pipe");
    if (d) { var tmp = document.createElement("div"); tmp.innerHTML = stepperHTML(v, true); d.replaceWith(tmp.firstChild); }
    var b = document.querySelector('#rdwDetail [data-act="suspend"]');
    if (b) {
      var susp = v.stage === "SUSPENDED";
      b.classList.toggle("on", susp); b.setAttribute("aria-pressed", String(susp));
      b.innerHTML = I.pause + "<span>" + esc(susp ? tr("rdw.resume") : tr("rdw.suspend")) + "</span>";
    }
    autosize(document.querySelector("#rdwDetail .rdw-title-in"));
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
    bindTips(el);
    var slot = headSlot();
    if (slot && !slot.__rdwBound) {
      slot.__rdwBound = true;
      slot.addEventListener("click", function (e) { if (e.target.closest && e.target.closest('[data-act="create"]')) openCreate(); });
    }
    el.addEventListener("scroll", function (e) {
      var l = e.target; if (!l || l.id !== "rdwList") return;
      if (l.scrollHeight - l.scrollTop - l.clientHeight < 160) loadMore();
    }, true);
    el.addEventListener("click", function (e) {
      var t = e.target.closest("[data-act]"); if (!t || !el.contains(t)) return;
      var a = t.getAttribute("data-act"), v = t.getAttribute("data-v");
      if (a === "mode") { ST.mode = v; renderSub(); renderBody(); fit(); }
      else if (a === "type") { ST.type = v; renderSub(); renderBody(); }
      else if (a === "clear") { ST.type = "ALL"; ST.ncc = ""; ST.q = ""; renderSub(); renderBody(); }
      else if (a === "more") loadMore();
      else if (a === "peek") openPeek(t.getAttribute("data-code"));
      else if (a === "mxAdd") openCreate({ group: t.getAttribute("data-g"), col: t.getAttribute("data-c") });
      else if (a === "mxMore") { var k = t.getAttribute("data-k"); ST.mxOpen[k] = !ST.mxOpen[k]; renderBody(); }
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
        else if (t.classList.contains("rdw-ta")) growTa(t);
        setDraft(ST.sel, t.getAttribute("data-f"), t.value);
      }
    });
    el.addEventListener("change", function (e) {
      var t = e.target;
      if (t.getAttribute("data-act") === "ncc") { ST.ncc = t.value; renderSub(); renderBody(); return; }
      if (t.getAttribute("data-act") === "typeSel") { ST.type = t.value; renderSub(); renderBody(); return; }
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
    document.querySelectorAll(".rdw .rdw-tab").forEach(function (b) { var n = b.querySelector(".rdw-tab-n"); if (n) n.textContent = cnt[b.getAttribute("data-v")]; });
  }

  /* Hoạt động nằm ở app chính (index.html): deeplink ?open=acts&activity_id=… / &q=… (xem js/lib/deeplink.js) */
  function openAct(id) {
    if (isDemo()) { toastMsg(tr("rdw.msg.actsOnMain")); return; }
    location.href = "index.html?open=acts&activity_id=" + encodeURIComponent(id) + "&from=rnd";
  }
  function openAllActs(q) {
    if (isDemo()) { toastMsg(tr("rdw.msg.actsOnMain")); return; }
    location.href = "index.html?open=acts" + (q ? "&q=" + encodeURIComponent(q) : "") + "&from=rnd";
  }

  /* Split view chiếm đúng phần còn lại của màn hình → từng panel cuộn riêng */
  function fit() {
    var el = root(); if (!el || el.style.display === "none") return;
    var body = document.getElementById("rdwBody"); if (!body) return;
    var top = body.getBoundingClientRect().top + window.scrollY;
    var h = Math.max(360, window.innerHeight - top);
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
  /* pre = { group, col } khi tạo từ nút "+" của một ô Ma trận → tự điền nhóm ứng dụng + nhà cung cấp */
  function openCreate(pre) {
    if (!canCreate()) return;
    var ov = ensureModal();
    M = { type: "ON_DEMAND", origin: "", ret: document.activeElement, pre: pre && pre.group ? pre : null };
    if (M.pre && !preRecords().length && canCreateInternal()) M.type = "INTERNAL";
    drawModal();
    ov.classList.add("open"); ov.setAttribute("aria-hidden", "false");
    setTimeout(function () { var f = ov.querySelector("select,input"); if (f) f.focus(); }, 20);
  }
  function preMatch(r) {
    var p = M.pre; if (!p) return true;
    return (p.group === OTHER || groupOf(r.segment) === p.group) && colOf(r) === p.col;
  }
  function preRecords() { return openRecords().filter(preMatch); }
  function closeCreate() {
    var ov = document.getElementById("rdwModalOv"); if (!ov) return;
    ov.classList.remove("open"); ov.setAttribute("aria-hidden", "true");
    if (M.ret && M.ret.focus) try { M.ret.focus(); } catch (e) {}
  }
  function mval(id) { var e = document.getElementById(id); return e ? String(e.value || "").trim() : ""; }

  function drawModal(keep) {
    var box = document.getElementById("rdwModal"); if (!box) return;
    var saved = keep ? { title: mval("rdwMTitleIn"), pic: mval("rdwMPic"), target: mval("rdwMTarget"), bench: mval("rdwMBench") } : {};
    var u = meNow(), picDef = saved.pic || (u && (typeof hasRole === "function" ? hasRole(u, "rnd") : u.role === "rnd") ? u.pic : (rndUsers()[0] || ""));
    var picOpts = rndUsers(); if (picDef && picOpts.indexOf(picDef) < 0) picOpts.unshift(picDef);
    var od = M.type === "ON_DEMAND";
    var body = "";
    if (od) {
      var all = openRecords(), recs = M.pre ? all.filter(preMatch) : all;
      if (M.pre && !recs.length) { body += '<p class="rdw-mute is-wide rdw-pre-note">' + esc(tr("rdw.m.preNone")) + "</p>"; recs = all; }
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
      var pN = M.pre && M.pre.col !== OTHER ? M.pre.col : "", pG = M.pre && M.pre.group !== OTHER ? M.pre.group : "";
      var groups = pG ? [pG] : Object.keys(t), one = pG && (t[pG] || []).length === 1 ? t[pG][0] : "";
      body += '<div class="rdw-mf"><label for="rdwMNcc">' + esc(tr("rdw.fld.ncc")) + ' <i class="req">*</i></label><select id="rdwMNcc" class="rdw-in"><option value="">' + esc(tr("rdw.m.nccPh")) + "</option>" +
          nccs.map(function (n) { return '<option value="' + esc(n) + '"' + (pN && nccMatch(n, pN) ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("") + "</select></div>" +
        '<div class="rdw-mf"><label for="rdwMSeg">' + esc(tr("rdw.fld.segment")) + ' <i class="req">*</i></label><select id="rdwMSeg" class="rdw-in"><option value="">' + esc(tr("rdw.m.segPh")) + "</option>" +
          groups.map(function (g) { return '<optgroup label="' + esc(g) + '">' + (t[g] || []).map(function (s) { return '<option value="' + esc(s) + '"' + (s === one ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("") + "</optgroup>"; }).join("") + "</select></div>" +
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
      '<div class="modal-head"><div><h3 id="rdwMTitle">' + esc(tr("rdw.m.title")) + '</h3><div class="mh-sub"><span class="rdw-mute">' + esc(tr("rdw.m.sub", { c: nextCode() })) +
          (M.pre ? " · " + esc(tr("rdw.m.preCell", { g: M.pre.group === OTHER ? tr("rdw.mx.unmapped") : M.pre.group, n: M.pre.col === OTHER ? tr("rdw.other") : M.pre.col })) : "") + "</span></div></div>" +
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

  /* ── Deeplink: rnd-workspace.html?open=…&mode=…&type=…&ncc=…&q=…&from=… ──
       open  = mã đề tài (RD-2026-001) hoặc mã dự án Sales (FI-0011 → đề tài liên kết dự án đó)
       mode  = split (mặc định) | matrix     type = ON_DEMAND | INTERNAL (mặc định: tất cả)
       ncc   = tên nhà cung cấp | other      q    = từ khoá tìm kiếm
       Trạng thái đang xem được ghi ngược vào URL (history.replaceState) → sao chép thanh địa chỉ là có link chia sẻ.
       Link cũ ?open=rnd&rd=RD-… vẫn đọc được. */
  var DL = { pending: false, applied: false };
  function readDL() {
    var p; try { p = new URLSearchParams(location.search); } catch (e) { return null; }
    var open = p.get("open") || "";
    if (open === "rnd") open = p.get("rd") || "";
    return { open: open.trim(), mode: p.get("mode") || "", type: p.get("type") || "", ncc: (p.get("ncc") || "").trim(), q: p.get("q") || "" };
  }
  function topicFor(id) {
    if (!id) return null;
    if (recOf(id)) return id;
    var a = list(), key = nKey(id);
    for (var i = 0; i < a.length; i++) if (nKey(a[i].originProjectId) === key && canSee(a[i])) return a[i].code;
    return null;
  }
  function applyDeepLink() {
    if (DL.applied) return;
    DL.applied = true;
    var d = readDL(); if (!d) return;
    if (d.mode === "matrix" || d.mode === "split") ST.mode = d.mode;
    if (d.type === "ON_DEMAND" || d.type === "INTERNAL") ST.type = d.type;
    if (d.ncc) {
      var k = d.ncc.toLowerCase();
      ST.ncc = k === "other" ? OTHER : (nccCols().filter(function (c) { return String(c).toLowerCase() === k; })[0] || "");
    }
    if (d.q) ST.q = d.q;
    if (!d.open) return;
    DL.pending = true;                       // chưa ghi URL cho tới khi tìm được đề tài (tránh ghi đè ?open=)
    var tries = 0, iv = setInterval(function () {   // chờ dữ liệu SharePoint về rồi mới chọn đề tài
      tries++;
      var code = topicFor(d.open);
      if (code && canSee(recOf(code))) { clearInterval(iv); DL.pending = false; focus(code); }
      else if (tries > 60) { clearInterval(iv); DL.pending = false; toastMsg(tr("rdw.msg.dlNotFound", { id: d.open })); syncUrl(); }
    }, 250);
  }
  function syncUrl() {
    if (DL.pending || !window.history || !history.replaceState || location.protocol === "file:") return;
    try {
      var from = new URLSearchParams(location.search).get("from"), n = new URLSearchParams();
      if (ST.mode === "split" && ST.sel) n.set("open", ST.sel);
      if (ST.mode === "matrix") n.set("mode", "matrix");
      if (ST.type !== "ALL") n.set("type", ST.type);
      if (ST.ncc) n.set("ncc", ST.ncc === OTHER ? "other" : ST.ncc);
      if (ST.q) n.set("q", ST.q);
      if (from) n.set("from", from);
      var qs = n.toString(), next = location.pathname + (qs ? "?" + qs : "") + location.hash;
      if (next !== location.pathname + location.search + location.hash) history.replaceState(null, "", next);
    } catch (e) {}
  }

  window.RND_WORKSPACE = {
    render: render, focus: focus, openPeek: openPeek, closePeek: closePeek, openCreate: openCreate, fit: fit, applyDeepLink: applyDeepLink, syncUrl: syncUrl, syncRing: syncRing,
    state: ST,
    hasDrafts: function () { return Object.keys(ST.drafts).length > 0; },
    /* dùng cho test / phase sau */
    _internals: { filtered: filtered, colOf: colOf, groupOf: groupOf, nextCode: nextCode, canEdit: canEdit, canSee: canSee, statusOfStage: statusOfStage }
  };
})();
