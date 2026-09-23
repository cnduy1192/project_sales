/* ============================================================
   Sales Funnel — Dashboard / Analytics
   Tab "Dashboard" trong salesfunnel.html & salesfunnel-demo.html.
   Dùng lại đúng tầng dữ liệu của trang danh sách (RECORDS, me,
   nccFilter, scopeRecords) — KHÔNG gọi SharePoint, KHÔNG reload.

   Phụ thuộc ngoài (CDN, tuỳ chọn):
     · ECharts 5  → vẽ biểu đồ. Thiếu vẫn chạy: KPI + bảng vẫn hiện.
     · CountUp.js → animate số KPI. Thiếu thì gán số trực tiếp.
   ============================================================ */
(function () {
  "use strict";

  /* ══════════ Tham số nghiệp vụ ══════════ */
  /* Không có đơn giá mặc định: đơn giá thay đổi theo mặt hàng và thời điểm, và
     trường "giá trị ước tính" của record là tuỳ chọn. Cơ hội chưa nhập đơn giá
     đóng góp 0 vào cột Giá trị và được đếm riêng để báo độ phủ. */
  var TABLE_MAX = 120;            // số dòng tối đa của bảng chi tiết
  var TOP_N     = 10;             // Top N dự án
  var PARETO_N  = 24;             // số sản phẩm đưa vào biểu đồ Pareto
  var PARETO_WINDOW = 8;          // số cột hiện cùng lúc; nhiều hơn thì bật DataZoom

  /* ══════════ State ══════════ */
  var metric = "vol";             // vol | val
  var period = "both";            // both (năm nay + năm sau) | this | next
  var F = { gbu: [], seg: [], stage: [], pic: [], status: [] };
  var X = null;                   // cross-filter: {src, type, value, label}
  var sortBy = "m", sortDir = -1; // bảng chi tiết
  var charts = {};                // id → echarts instance
  var ready = false, booted = false, openDD = null;

  var CLR = {
    "Tiếp cận": "#1E3A8A", "Thử mẫu": "#0D9488", "Đàm phán": "#6D28D9", "Hoãn": "#B45309",
    WON: "#157F3C", LOST: "#B91C46", PRI: "#0E6BA8", LINE: "#E4E6EC", INK3: "#697082", INK: "#0B2436"
  };
  /* Bảng màu nhóm ngành — Tailwind indigo / teal / slate, tông trầm kiểu
     enterprise, không dùng hồng cánh sen. */
  var GBU_CLR = { SAVOURY: "#4F46E5", SWEET: "#0D9488", BAKERY: "#475569" };
  var SEG_PAL = ["#4F46E5", "#0D9488", "#475569", "#0369A1", "#7C3AED", "#0E7490",
    "#15803D", "#B45309", "#1D4ED8", "#9F1239", "#334155", "#0891B2", "#6D28D9"];

  /* ══════════ Helpers ══════════ */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (x && !s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function num(n) { return (Math.round(n) || 0).toLocaleString(I18N.locale()); }
  function initials(n) {
    return String(n || "?").trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase();
  }
  function picColor(p) {
    var u = (typeof USERS !== "undefined" ? USERS : []).filter(function (x) { return x.pic === p; })[0];
    return (u && u.color) || "#4A5F70";
  }
  function daysBetween(a, b) { return Math.round((a - b) / 86400000); }

  /* ---- đo lường ---- */
  var PERIODS = {
    both: { k: "both", get t() { return T("dash.period.both"); }, get full() { return T("dash.period.bothFull"); } },
    this: { k: "this", get t() { return T("dash.period.this"); }, get full() { return T("dash.period.thisFull"); } },
    next: { k: "next", get t() { return T("dash.period.next"); }, get full() { return T("dash.period.nextFull"); } }
  };
  function volOf(r) {
    var a = +r.kgThis || 0, b = +r.kgNext || 0;
    return period === "this" ? a : period === "next" ? b : a + b;
  }
  /* Đơn giá của record: suy từ "giá trị ước tính" đã nhập chia cho sản lượng gốc.
     Chưa nhập → coi như chưa có đơn giá (0), KHÔNG tự bịa đơn giá mặc định. */
  function unitOf(r) {
    var amt = +r.amount || 0; if (amt <= 0) return 0;
    var basis = (+r.kgThis || 0) || (+r.kgNext || 0);
    return basis > 0 ? amt / basis : 0;
  }
  function hasPrice(r) { return unitOf(r) > 0; }
  function isEst(r) { return !hasPrice(r); }
  function valOf(r) { return volOf(r) * unitOf(r); }
  function mOf(r) { return metric === "vol" ? volOf(r) : valOf(r); }
  function wOf(r) { return mOf(r) * (+r.prob || 0); }
  function unitLabel() { return metric === "vol" ? "KG" : "₫"; }

  /* ---- format theo metric ---- */
  function fmtVol(n) {
    n = n || 0;
    if (n >= 1e6) return num(n / 1000) + " MT";
    return num(n) + " KG";
  }
  function fmtVal(n) {
    n = n || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(".", I18N.decSep()) + " " + T("unit.bnVnd");
    if (n >= 1e6) return num(n / 1e6) + " " + T("unit.mnVnd");
    return num(n) + " ₫";
  }
  function fmtM(n) { return metric === "vol" ? fmtVol(n) : fmtVal(n); }
  /* Đơn vị trục được chốt MỘT LẦN theo giá trị lớn nhất của chart, để mọi vạch
     trên cùng một trục cùng đơn vị. Sản lượng dùng "k KG" / "MT" (không dùng "T"
     vì dễ đọc nhầm thành "tỷ"). */
  function axisScale(maxV) {
    maxV = Math.abs(maxV || 0);
    if (metric === "vol") return maxV >= 1e4 ? { d: 1000, u: " MT" } : { d: 1, u: " KG" };
    if (maxV >= 1e9) return { d: 1e9, u: " " + T("unit.bnVnd") };
    if (maxV >= 1e6) return { d: 1e6, u: " " + T("unit.mnVnd") };
    return { d: 1, u: " ₫" };
  }
  function axisFmt(sc) {
    return function (n) {
      var v = (n || 0) / sc.d;
      if (!v) return "0";
      var t = Math.abs(v) >= 100 ? num(v) : String(+v.toFixed(Math.abs(v) >= 10 ? 0 : 1)).replace(".", I18N.decSep());
      return t + sc.u;
    };
  }
  /* rút gọn không kèm đơn vị — dùng cho nhãn đầu thanh bar */
  function fmtAxis(n) {
    n = n || 0;
    if (metric === "vol") return n >= 1e6 ? num(n / 1000) + " MT" : n >= 1e3 ? num(n / 1e3) + "k" : num(n);
    return n >= 1e9 ? (n / 1e9).toFixed(1).replace(".", I18N.decSep()) + " " + T("unit.bn") : n >= 1e6 ? num(n / 1e6) + " " + T("unit.mn") : num(n);
  }
  /* tách số + đơn vị cho CountUp */
  /* ref: giá trị tham chiếu để chọn đơn vị — truyền tổng pipeline vào đây thì
     ô "trọng số" dùng chung đơn vị với ô "tổng", đọc cạnh nhau không bị lệch. */
  function splitM(n, ref) {
    n = n || 0;
    var r = (ref == null ? n : ref) || 0;
    if (metric === "vol") return r >= 1e6 ? { v: n / 1000, d: 0, u: "MT" } : { v: n, d: 0, u: "KG" };
    if (r >= 1e9) return { v: n / 1e9, d: 2, u: T("unit.bnVnd") };
    if (r >= 1e6) return { v: n / 1e6, d: 0, u: T("unit.mnVnd") };
    return { v: n, d: 0, u: "₫" };
  }

  /* ---- phân loại ---- */
  function allNcc() { try { return isAllNcc(); } catch (e) { return true; } }
  function stageKey(r) {
    if (r.status === "WON") return "WON";
    if (r.status === "LOST") return "LOST";
    return allNcc() ? (STAGE_GROUP[r.stage] || r.stage) : r.stage;
  }
  function rawStage(r) { return allNcc() ? (STAGE_GROUP[r.stage] || r.stage) : r.stage; }
  function stageColor(k) {
    if (CLR[k]) return CLR[k];
    var g = STAGE_GROUP[k] || k;
    return CLR[g] || CLR.PRI;
  }
  function stageCls2(k) {
    if (k === "WON") return "p-won";
    if (k === "LOST") return "p-lost";
    var g = STAGE_GROUP[k] || k;
    return ({ "Tiếp cận": "p-sbg", "Thử mẫu": "p-st", "Đàm phán": "p-oa", "Hoãn": "p-prog" })[g] || "p-st";
  }
  function stageShort(s) {
    return String(s || "").replace("SHARED BUSINESS GOAL", "SHARED GOAL").replace("BUILDING A SOLUTION", "BUILDING")
      .replace("SOLUTION TESTING", "TESTING").replace("OFFER & AGREEMENT", "OFFER").replace("QUOTED / PO", "QUOTED/PO")
      .replace("TEST PASSED", "PASSED");
  }
  function stageLbl(k) { return k === "WON" ? T("status.won") : k === "LOST" ? T("status.lost") : tv(stageShort(k)); }
  function segFull(r) { return (r.group ? r.group + " | " : "") + (r.segment || "—"); }
  function isLate(r) {
    try { return r.status === "IN PROGRESS" && r.closing && new Date(r.closing) < TODAY; } catch (e) { return false; }
  }

  /* ══════════ Lấy & lọc dữ liệu ══════════ */
  function base() {
    if (typeof RECORDS === "undefined" || typeof me === "undefined" || !me) return [];
    var pool = RECORDS.filter(function (r) { return allNcc() || !nccFilter || r.ncc === nccFilter; });
    try { return scopeRecords(pool, me) || []; } catch (e) { return pool; }
  }
  function passF(r) {
    if (F.status.length && F.status.indexOf(r.status) < 0) return false;
    if (F.gbu.length && F.gbu.indexOf(r.group || "—") < 0) return false;
    if (F.seg.length && F.seg.indexOf(r.segment || "—") < 0) return false;
    if (F.stage.length && F.stage.indexOf(stageKey(r)) < 0) return false;
    if (F.pic.length && F.pic.indexOf(r.pic || "—") < 0) return false;
    return true;
  }
  function passX(r) {
    if (!X) return true;
    switch (X.type) {
      case "rec": return r.id === X.value;
      case "customer": return r.customer === X.value;
      case "product": return r.product === X.value;
      case "gbu": return (r.group || "—") === X.value;
      case "seg": return (r.segment || "—") === X.value;
      case "pic": return (r.pic || "—") === X.value;
      case "stage": return stageKey(r) === X.value;
      case "status": return r.status === X.value;
      default: return true;
    }
  }
  /* src = id của chart đang vẽ; chart tự phát sinh cross-filter thì không tự lọc mình */
  function rows(src) {
    return base().filter(function (r) {
      return passF(r) && (!X || (src && X.src === src) || passX(r));
    });
  }

  /* ══════════ Dựng khung ══════════ */
  var SHELL =
    '<div class="sf-dbar">' +
      '<span class="sf-dbar-l" data-i18n="dash.period">Kỳ</span>' +
      '<div class="sf-seg2" role="group" aria-label="Kỳ số liệu" data-i18n-aria-label="dash.periodAria">' +
        '<b id="pBoth" class="on" title="Sản lượng năm nay + tiềm năng năm sau" data-i18n-title="dash.period.bothHint" data-i18n="dash.period.both" onclick="SFD.setPeriod(\'both\')">Tổng</b>' +
        '<b id="pThis" title="Chỉ sản lượng năm nay" data-i18n-title="dash.period.thisHint" data-i18n="dash.period.this" onclick="SFD.setPeriod(\'this\')">Năm nay</b>' +
        '<b id="pNext" title="Chỉ tiềm năng năm sau" data-i18n-title="dash.period.nextHint" data-i18n="dash.period.next" onclick="SFD.setPeriod(\'next\')">Năm sau</b>' +
      "</div>" +
      '<span class="sf-dbar-l" style="margin-left:6px" data-i18n="common.filter">Lọc</span>' +
      '<div id="ddWrap" style="display:contents"></div>' +
      '<button type="button" class="sf-dreset" id="sfDReset" hidden onclick="SFD.reset()">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg><span data-i18n="common.clearFilters">Xoá bộ lọc</span></button>' +
      '<div class="sf-seg2 sf-metric" role="group" aria-label="Chỉ số" data-i18n-aria-label="dash.metric">' +
        '<b id="mVol" class="on" data-i18n="dash.metricVol" onclick="SFD.setMetric(\'vol\')">Sản lượng (KG)</b>' +
        '<b id="mVal" data-i18n="dash.metricVal" onclick="SFD.setMetric(\'val\')">Giá trị (₫)</b>' +
      '</div>' +
    '</div>' +
    '<div class="sf-chips" id="sfChips" hidden></div>' +
    '<div class="sf-dash-inner">' +
      '<div id="sfDNote"></div>' +
      '<div class="sf-grid" id="kpiRow"></div>' +
      '<div class="sf-grid">' +
        '<section class="sf-card c7"><div class="sf-card-h"><h3 data-i18n="dash.ch.top">Top Dự án Chủ lực</h3></div>' +
          '<div class="sf-chart" id="chTop" style="min-height:360px"></div></section>' +
        '<section class="sf-card c5"><div class="sf-card-h"><h3 data-i18n="dash.ch.stages">Giai đoạn Pipeline</h3>' +
          '<span class="sf-meta" id="funMeta"></span></div>' +
          '<div class="sf-chart" id="chFun" style="min-height:360px"></div></section>' +
        '<section class="sf-card c7"><div class="sf-card-h"><h3 data-i18n="dash.ch.pareto">Danh mục Sản phẩm (Pareto 80/20)</h3></div>' +
          '<div class="sf-chart" id="chPar" style="min-height:330px"></div></section>' +
        '<section class="sf-card c5"><div class="sf-card-h"><h3 data-i18n="dash.ch.market">Cơ cấu Thị trường</h3>' +
          '<button type="button" class="sf-back" id="segBack" hidden onclick="SFD.segUp()">← <span data-i18n="dash.allGroups">Tất cả nhóm</span></button></div>' +
          '<div class="sf-chart" id="chSeg" style="min-height:330px"></div></section>' +
        '<section class="sf-card c12"><div class="sf-card-h"><h3 data-i18n="dash.ch.team">Hiệu quả theo Nhân viên Sales</h3></div>' +
          '<div class="sf-chart" id="chPic" style="min-height:250px"></div></section>' +
        '<section class="sf-card c12"><div class="sf-card-h"><h3 data-i18n="dash.ch.detail">Chi tiết Dự án</h3>' +
          '<span class="sf-meta" id="tblSub"></span></div>' +
          '<div class="sf-tbl-wrap" id="sfTbl"></div></section>' +
      '</div>' +
    '</div>';

  function mount() {
    if (booted) return true;
    var app = $("sfApp"); if (!app) return false;
    var host = document.createElement("div");
    host.className = "sf-dash"; host.id = "sfDash";
    host.innerHTML = SHELL;
    if (window.I18N) I18N.apply(host);
    var main = app.querySelector(".sf-main");
    if (main && main.parentNode) main.parentNode.insertBefore(host, main.nextSibling); else app.appendChild(host);

    /* view switcher vào sub-bar + đánh dấu các control chỉ dành cho tab danh sách */
    var sub = app.querySelector(".sf-subbar");
    if (sub && !$("sfViewSeg")) {
      var seg = document.createElement("div");
      seg.className = "sf-view-seg"; seg.id = "sfViewSeg"; seg.setAttribute("role", "group");
      seg.setAttribute("data-i18n-aria-label", "dash.viewMode"); seg.setAttribute("aria-label", T("dash.viewMode"));
      seg.innerHTML =
        '<button type="button" class="sf-view-b" id="vbDash" onclick="SFD.show(true)" aria-pressed="false">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg><span data-i18n="sf.viewDash">Dashboard</span></button>' +
        '<button type="button" class="sf-view-b on" id="vbList" onclick="SFD.show(false)" aria-pressed="true">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg><span data-i18n="sf.viewList">Danh sách</span></button>';
      sub.insertBefore(seg, sub.firstChild);
      if (window.I18N) I18N.apply(seg);
      ["#sfStatusSeg", ".sf-search-sub", "#sfExpandAll"].forEach(function (s) {
        var el = sub.querySelector(s); if (el) el.classList.add("sf-only-list");
      });
    }
    booted = true;
    bindGlobal();
    watch();
    return true;
  }

  /* ══════════ Dropdown lọc ══════════ */
  var CK = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5.2 5.2L20 7"/></svg>';
  var CV = '<svg class="sf-dd-cv" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';

  var DD = [
    { k: "status", get t() { return T("common.status"); }, of: function (r) { return r.status; },
      lab: function (v) { return (typeof STATUS_VI !== "undefined" && STATUS_VI[v]) || v; } },
    { k: "gbu", get t() { return T("common.segmentGroup"); }, of: function (r) { return r.group || "—"; } },
    { k: "seg", get t() { return T("common.segment"); }, of: function (r) { return r.segment || "—"; } },
    { k: "stage", get t() { return T("common.stage"); }, of: stageKey, lab: stageLbl },
    { k: "pic", get t() { return T("common.owner"); }, of: function (r) { return r.pic || "—"; } }
  ];

  function renderDD() {
    var wrap = $("ddWrap"); if (!wrap) return;
    var pool = base();
    wrap.innerHTML = DD.map(function (d) {
      var cnt = {};
      pool.forEach(function (r) { var v = d.of(r); cnt[v] = (cnt[v] || 0) + 1; });
      var vals = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
      var sel = F[d.k] || [];
      var opts = vals.map(function (v) {
        var on = sel.indexOf(v) >= 0;
        return '<button type="button" class="sf-dd-opt' + (on ? " on" : "") + '" role="option" aria-selected="' + on + '"' +
          ' onclick="SFD.pick(\'' + d.k + '\',' + JSON.stringify(v).replace(/"/g, "&quot;") + ')">' +
          '<span class="bx">' + CK + "</span>" + esc((d.lab ? d.lab(v) : v)) +
          '<span class="ct">' + cnt[v] + "</span></button>";
      }).join("");
      return '<div class="sf-dd' + (sel.length ? " on" : "") + '" id="dd_' + d.k + '">' +
        '<button type="button" class="sf-dd-btn" onclick="SFD.dd(\'' + d.k + '\')" aria-haspopup="listbox">' +
          esc(d.t) + (sel.length ? '<span class="sf-dd-n">' + sel.length + "</span>" : "") + CV + "</button>" +
        '<div class="sf-dd-pop" role="listbox" hidden>' +
          '<div class="sf-dd-head"><button type="button" onclick="SFD.all(\'' + d.k + '\')">' + T("common.selectAll") + '</button>' +
          '<button type="button" onclick="SFD.none(\'' + d.k + '\')">' + T("common.deselectAll") + '</button></div>' +
          (opts || '<div style="padding:10px;font-size:12px;color:var(--ink-3)">' + T("common.noData") + '</div>') +
        "</div></div>";
    }).join("");
  }
  function ddToggle(k, force) {
    var box = $("dd_" + k); if (!box) return;
    var pop = box.querySelector(".sf-dd-pop");
    var on = force != null ? force : pop.hidden;
    if (openDD && openDD !== k) ddToggle(openDD, false);
    pop.hidden = !on; box.classList.toggle("open", on);
    openDD = on ? k : null;
  }
  function bindGlobal() {
    document.addEventListener("click", function (e) {
      if (openDD && !e.target.closest(".sf-dd")) ddToggle(openDD, false);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && openDD) ddToggle(openDD, false); });
    var t;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(resizeAll, 140); });
  }
  /* Dropdown NCC của trang danh sách gọi hàm nội bộ của funnel-sf.js, không đi qua
     window.SF, nên bọc hàm là không đủ. Theo dõi trực tiếp "chữ ký" của phạm vi
     dữ liệu — cũng bắt luôn lúc dữ liệu SharePoint về muộn. */
  function sig() {
    try {
      return [nccFilter, (typeof RECORDS === "undefined" ? 0 : RECORDS.length),
        (typeof me !== "undefined" && me ? me.pic : ""), segRoot || ""].join("|");
    } catch (e) { return ""; }
  }
  var lastSig = null, watchT = null;
  function watch() {
    clearInterval(watchT);
    watchT = setInterval(function () {
      if (!booted || !document.body.classList.contains("sf-view-dash")) return;
      var s2 = sig();
      if (lastSig === null) { lastSig = s2; return; }
      if (s2 !== lastSig) { lastSig = s2; paint(); }
    }, 300);
    var box = document.getElementById("sfNcc");
    if (box && !box.__sfd) {
      box.__sfd = 1;
      box.addEventListener("click", function () { setTimeout(function () { lastSig = sig(); paint(); }, 0); });
    }
  }

  function resizeAll() {
    Object.keys(charts).forEach(function (k) { try { charts[k].resize(); } catch (e) {} });
  }

  /* ══════════ KPI ══════════ */
  function countTo(el, v, dec) {
    if (!el) return;
    var txt = v.toLocaleString(I18N.locale(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
    try {
      if (window.countUp && window.countUp.CountUp) {
        var c = new window.countUp.CountUp(el, v, {
          duration: 0.7, decimalPlaces: dec, separator: I18N.decSep() === "," ? "." : ",", decimal: I18N.decSep(), useEasing: true
        });
        if (!c.error) { el.textContent = "0"; c.start(); return; }
      }
    } catch (e) {}
    el.textContent = txt;
  }
  function kpiCard(cls, title, id, sub) {
    return '<div class="sf-kpi ' + cls + '">' +
      '<div class="sf-kpi-t" id="' + id + '_t">' + title + "</div>" +
      '<div class="sf-kpi-v"><span id="' + id + '">0</span><small id="' + id + '_u"></small></div>' +
      '<div class="sf-kpi-s" id="' + id + '_s">' + sub + "</div></div>";
  }
  function renderKPI(rs) {
    var row = $("kpiRow"); if (!row) return;
    if (!row.dataset.built) {
      row.innerHTML =
        '<div class="c4">' + kpiCard("k1", T("dash.kpi.pipeline"), "k1", "—") + "</div>" +
        '<div class="c4">' + kpiCard("k2", T("dash.kpi.weightedVal"), "k2", "—") + "</div>" +
        '<div class="c4">' + kpiCard("k3", T("dash.kpi.winRate"), "k3", "—") + "</div>" +
        '<div class="c4">' + kpiCard("k4", T("dash.kpi.openBop"), "k4", "—") + "</div>";
      row.dataset.built = "1";
    }
    var total = 0, weighted = 0, volT = 0, valT = 0, est = 0;
    var won = [], lost = [], act = [], late = 0, ageSum = 0;
    rs.forEach(function (r) {
      total += mOf(r); weighted += wOf(r); volT += volOf(r); valT += valOf(r);
      if (isEst(r)) est++;
      if (r.status === "WON") won.push(r);
      else if (r.status === "LOST") lost.push(r);
      else {
        act.push(r);
        if (isLate(r)) late++;
        try { var c = new Date(r.created); if (!isNaN(c)) ageSum += Math.max(0, daysBetween(TODAY, c)); } catch (e) {}
      }
    });
    var closed = won.length + lost.length;
    var winRate = closed ? (won.length / closed) * 100 : 0;
    var avg = rs.length ? total / rs.length : 0;
    var age = act.length ? Math.round(ageSum / act.length) : 0;

    var a = splitM(total);
    countTo($("k1"), a.v, a.d); $("k1_u").textContent = " " + a.u;
    $("k1_s").innerHTML = PERIODS[period].full + " · " + T("dash.nOppsB", { n: num(rs.length) });

    var b = splitM(weighted, total);
    countTo($("k2"), b.v, b.d); $("k2_u").textContent = " " + b.u;
    var wp = total ? (weighted / total) * 100 : 0;
    $("k2_t").textContent = metric === "vol" ? T("dash.kpi.weightedVol") : T("dash.kpi.weightedVal");
    $("k2_s").innerHTML = T("dash.kpi.weightedFormula", { m: metric === "vol" ? T("dash.volLower") : T("dash.valLower") }) +
      ' · <span class="sf-pill wt">' + T("dash.pctOfTotal", { p: wp.toFixed(0) }) + "</span>";

    countTo($("k3"), winRate, 0); $("k3_u").textContent = "%";
    $("k3_s").innerHTML = T("dash.kpi.winLoss", { w: won.length, l: lost.length, avg: fmtM(avg) });

    countTo($("k4"), act.length, 0); $("k4_u").textContent = "";
    $("k4_s").innerHTML = T("dash.kpi.avgAge", { n: age }) +
      (late ? ' · <span class="sf-pill dn">' + T("dash.nOverdue", { n: late }) + "</span>" : ' · <span class="sf-pill up">' + T("dash.onTrack") + "</span>");

    var note = $("sfDNote");
    if (note) {
      var msg = "";
      if (!window.echarts) msg = '<div class="sf-dnote err">' + T("dash.noEcharts") + '</div>';
      else if (metric === "val" && est) {
        var covVol = 0, allVol = 0;
        rs.forEach(function (r) { allVol += volOf(r); if (hasPrice(r)) covVol += volOf(r); });
        msg = '<div class="sf-dnote">' + T("dash.priceCoverage", { a: est, b: rs.length, p: allVol ? Math.round(covVol / allVol * 100) : 0 }) + "</div>";
      }
      note.innerHTML = msg;
    }
  }

  /* ══════════ Tooltip HTML ══════════ */
  function tt(head, sub, lines, foot) {
    return '<div class="sf-tt"><div class="sf-tt-h">' + esc(head) + "</div>" +
      (sub ? '<div class="sf-tt-s">' + esc(sub) + "</div>" : "") +
      lines.map(function (l) {
        return '<div class="sf-tt-r">' + (l.c ? '<span class="sf-tt-d" style="background:' + l.c + '"></span>' : "") +
          "<em>" + esc(l.k) + "</em><b>" + l.v + "</b></div>";
      }).join("") +
      (foot ? '<div class="sf-tt-f">' + foot + "</div>" : "") + "</div>";
  }
  var TT_BOX = {
    backgroundColor: "#fff", borderColor: "#E4E6EC", borderWidth: 1, padding: [9, 11],
    extraCssText: "border-radius:11px;box-shadow:0 20px 48px rgba(16,24,40,.18);",
    transitionDuration: 0, confine: true, enterable: false, hideDelay: 40,
    textStyle: { color: "#16181D", fontSize: 12 }
  };
  var GRID_F = { fontFamily: "Inter, system-ui, sans-serif" };

  /* Lấy/khởi tạo instance. Ẩn tooltip trước khi setOption(notMerge) —
     nếu không, tooltip đang chờ hiện sẽ trỏ vào DOM đã bị huỷ (lỗi của ECharts). */
  /* làm sáng màu khi hover (thay cho nhãn "bấm để lọc") */
  function lift(c, amt) {
    try { return window.echarts.color.lift(c, amt == null ? -0.16 : amt); } catch (e) { return c; }
  }
  var HOVER = { shadowBlur: 10, shadowColor: "rgba(11,36,54,.22)" };
  /* Trạng thái "blur" mặc định của ECharts hạ opacity xuống ~0.1 khiến biểu đồ
     trông như biến mất khi rê chuột. Khai báo tường minh để giữ mọi thứ đọc được. */
  var BLUR = { itemStyle: { opacity: .55 }, label: { opacity: .55 } };

  function ec(id) {
    var el = $(id); if (!el || !window.echarts) return null;
    if (charts[id] && !charts[id].isDisposed()) {
      try { charts[id].dispatchAction({ type: "hideTip" }); } catch (e) {}
      try { charts[id].dispatchAction({ type: "downplay" }); } catch (e) {}
      return charts[id];
    }
    try {
      /* KHÔNG bật useDirtyRect: khi setOption(notMerge) đổi hẳn cấu trúc
         (vd. Sunburst drill-down) nó để lại pixel nhãn cũ → nhìn như chữ bị nhân đôi. */
      charts[id] = window.echarts.init(el, null, {
        renderer: "canvas", devicePixelRatio: window.devicePixelRatio || 1
      });
      return charts[id];
    } catch (e) { return null; }
  }

  /* ══════════ Chart 1 — Top N dự án ══════════ */
  /* Nhãn trục Y chiếm hẳn 28% bề ngang, cắt bằng "…", tên đầy đủ nằm ở tooltip. */
  function chTop() {
    var c = ec("chTop"); if (!c) return;
    var rs = rows("top").slice().sort(function (a, b) { return mOf(b) - mOf(a); }).slice(0, TOP_N).reverse();
    if (!rs.length) { c.clear(); return; }
    var labW = Math.max(96, Math.round(c.getWidth() * 0.28) - 22);
    var scT = axisScale(Math.max.apply(null, rs.map(mOf)));
    c.setOption({
      grid: { left: "28%", right: 78, top: 26, bottom: 30, containLabel: false },
      xAxis: {
        type: "value",
        name: "[" + scT.u.trim() + "]", nameLocation: "end", nameGap: 24,
        nameTextStyle: { color: CLR.INK3, fontSize: 10.5, fontWeight: 600, align: "center" },
        axisLabel: { formatter: function (v) { return axisFmt(scT)(v).replace(scT.u, ""); }, color: CLR.INK3, fontSize: 11 },
        splitLine: { lineStyle: { color: CLR.LINE, type: "dashed" } }, axisLine: { show: false }, axisTick: { show: false }
      },
      yAxis: {
        type: "category", data: rs.map(function (r) { return r.customer + " · " + r.product; }),
        axisLabel: {
          color: CLR.INK, fontSize: 11.5, fontWeight: 500, margin: 14,
          width: labW, overflow: "truncate", ellipsis: "…"
        },
        axisLine: { show: false }, axisTick: { show: false }
      },
      tooltip: Object.assign({
        trigger: "item", formatter: function (p) {
          var r = rs[p.dataIndex];
          return tt(r.customer, r.product + " · " + (r.application || "—"), [
            { k: T("common.volume"), v: fmtVol(volOf(r)) },
            { k: T("common.value") + (isEst(r) ? " " + T("dash.estSuffix") : ""), v: fmtVal(valOf(r)) },
            { k: T("common.stage"), v: esc(stageLbl(stageKey(r))), c: stageColor(stageKey(r)) },
            { k: T("sf.probability"), v: Math.round((r.prob || 0) * 100) + "%" },
            { k: T("common.owner"), v: esc(r.pic || "—") }
          ], T("dash.idLabel", { id: esc(r.id) }) + (isLate(r) ? " · <span style='color:#DC2626'>" + T("dash.overdueLower") + "</span>" : ""));
        }
      }, TT_BOX),
      series: [{
        type: "bar", barMaxWidth: 20, cursor: "pointer",
        itemStyle: { borderRadius: [0, 5, 5, 0] },
        emphasis: { itemStyle: HOVER },
        blur: BLUR,
        label: {
          show: true, position: "right", distance: 7, fontSize: 11, fontWeight: 600, color: CLR.INK,
          formatter: function (p) { return axisFmt(scT)(p.value); }
        },
        data: rs.map(function (r) {
          var col = stageColor(stageKey(r));
          return { value: mOf(r), itemStyle: { color: col }, emphasis: { itemStyle: { color: lift(col) } } };
        }),
        animationDuration: 420, animationDurationUpdate: 260
      }],
      textStyle: GRID_F
    }, true);
    c.off("click");
    c.on("click", function (p) {
      var r = rs[p.dataIndex]; if (r) cross("top", "rec", r.id, r.customer + " · " + r.product);
    });
  }

  /* ══════════ Chart 2 — Giai đoạn Pipeline ══════════
     CHỈ vẽ các giai đoạn trong pipeline của nhà cung cấp — không có hàng kết quả
     (Thắng / Thua / Hoãn), vì đó là vòng đời dự án chứ không phải bước quy trình.

     · Chọn 1 NCC  → đúng pipeline của NCC đó (pipelineOf: NCC nào không khai báo
       pipeline riêng thì tự dùng pipeline Roquette làm chuẩn).
     · "Tất cả NCC" → gộp về nhóm giai đoạn dùng chung, vì Roquette có 4 bước còn
       IFF/Kimica có 5 bước tên khác nhau, không quy về một bộ tên chung được.

     Giai đoạn rỗng vẫn vẽ (nhãn "0 dự án") nên không bao giờ có hàng trống vô nghĩa. */
  function funnelStages() {
    if (!allNcc() && nccFilter) {
      try { return pipelineOf(nccFilter).filter(function (s) { return (STAGE_GROUP[s] || s) !== "Hoãn"; }); } catch (e) {}
    }
    return ["Tiếp cận", "Thử mẫu", "Đàm phán"];
  }
  function chFun() {
    var c = ec("chFun"); if (!c) return;
    var order = funnelStages();
    var rs = rows("fun");
    var lv = order.map(function (s) { return { name: stageLbl(s), raw: s, n: 0, m: 0 }; });
    var idx = {}; order.forEach(function (s, i) { idx[s] = i; });
    var outN = 0;                    // thắng / thua / hoãn — nằm ngoài pipeline
    rs.forEach(function (r) {
      if (r.status !== "IN PROGRESS" || r.onHold) { outN++; return; }
      var i = idx[rawStage(r)];
      if (i == null) { outN++; return; }   // stage ngoài pipeline (vd. POSTPONED)
      lv[i].n++; lv[i].m += mOf(r);
    });
    var data = lv;

    var totN = data.reduce(function (t, d) { return t + d.n; }, 0);
    var totM = data.reduce(function (t, d) { return t + d.m; }, 0);
    var meta = $("funMeta");
    if (meta) {
      meta.textContent = totN || outN ? T("sf.nOpps", { n: outN ? num(totN) + "/" + num(totN + outN) : num(totN) }) : "";
      meta.title = outN ? T("dash.outOfPipe", { n: outN }) : "";
    }
    if (!totN) { c.clear(); return; }

    var sc = axisScale(Math.max.apply(null, data.map(function (d) { return d.m; })));
    var fmt = axisFmt(sc);
    var h = Math.max(240, data.length * 46 + 74);
    var el = $("chFun"); if (el) el.style.height = h + "px";
    try { c.resize(); } catch (e) {}

    c.setOption({
      grid: { left: 16, right: 96, top: 26, bottom: 6, containLabel: true },
      xAxis: {
        type: "value", min: 0,
        name: "[" + sc.u.trim() + "]", nameLocation: "end", nameGap: 24,
        nameTextStyle: { color: CLR.INK3, fontSize: 10.5, fontWeight: 600, align: "center" },
        axisLabel: { formatter: function (v) { return fmt(v).replace(sc.u, ""); }, color: CLR.INK3, fontSize: 11 },
        splitLine: { lineStyle: { color: CLR.LINE, type: "dashed" } },
        axisLine: { show: false }, axisTick: { show: false }
      },
      yAxis: {
        type: "category", inverse: true,
        data: data.map(function (d) { return d.name; }),
        axisLabel: { color: CLR.INK, fontSize: 11.5, fontWeight: 600, width: 96, overflow: "truncate", ellipsis: "…" },
        axisLine: { show: false }, axisTick: { show: false }
      },
      tooltip: Object.assign({
        trigger: "item", formatter: function (p) {
          var d = data[p.dataIndex];
          return tt(d.name, T("dash.atStage"), [
            { k: T("dash.oppCount"), v: num(d.n), c: stageColor(d.raw) },
            { k: metric === "vol" ? T("common.volume") : T("common.value"), v: fmtM(d.m) },
            { k: T("dash.shareOpps"), v: (totN ? d.n / totN * 100 : 0).toFixed(0) + "%" },
            { k: T("dash.shareOf", { m: metric === "vol" ? T("dash.volLower") : T("dash.valLower") }), v: (totM ? d.m / totM * 100 : 0).toFixed(0) + "%" }
          ]);
        }
      }, TT_BOX),
      series: [{
        type: "bar", barMaxWidth: 22, cursor: "pointer",
        /* Màu và màu-khi-hover phải nằm trên TỪNG data item.
           emphasis.itemStyle.color KHÔNG nhận hàm callback — truyền hàm vào đây
           làm fill thành không hợp lệ và cả biểu đồ biến mất lúc rê chuột. */
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        emphasis: { itemStyle: HOVER },
        blur: BLUR,
        /* nhãn luôn hiện, kể cả khi giá trị = 0 → không có hàng trống khó hiểu */
        label: {
          show: true, position: "right", distance: 8, fontSize: 11, fontWeight: 600, color: CLR.INK,
          formatter: function (p) {
            var d = data[p.dataIndex];
            return d.n ? T("dash.nOppsShort", { n: d.n }) + " · " + fmt(d.m) : T("dash.nOppsShort", { n: 0 });
          }
        },
        data: data.map(function (d) {
          var col = stageColor(d.raw);
          return {
            value: d.m,
            itemStyle: { color: col, opacity: d.n ? 1 : .22 },
            emphasis: { itemStyle: { color: lift(col), opacity: 1 } }
          };
        }),
        animationDuration: 420, animationDurationUpdate: 260
      }],
      textStyle: GRID_F
    }, true);
    c.off("click");
    c.on("click", function (p) {
      var d = data[p.dataIndex]; if (!d || !d.n) return;
      cross("fun", "stage", d.raw, stageLbl(d.raw));
    });
  }

  /* ══════════ Chart 3 — Pareto sản phẩm ══════════ */
  /* Trên 8 sản phẩm thì bật DataZoom ngang (kéo thanh trượt hoặc lăn chuột). */
  function chPar() {
    var c = ec("chPar"); if (!c) return;
    var g = {};
    rows("par").forEach(function (r) {
      var k = r.product || "—";
      if (!g[k]) g[k] = { n: 0, m: 0 };
      g[k].n++; g[k].m += mOf(r);
    });
    var arr = Object.keys(g).map(function (k) { return { k: k, n: g[k].n, m: g[k].m }; })
      .sort(function (a, b) { return b.m - a.m; });
    if (!arr.length) { c.clear(); return; }
    var grand = arr.reduce(function (s, x) { return s + x.m; }, 0) || 1;
    var top = arr.slice(0, PARETO_N), run = 0;
    var cum = top.map(function (x) { run += x.m; return +(run / grand * 100).toFixed(1); });
    var idx80 = cum.findIndex(function (v) { return v >= 80; });
    var scP = axisScale(Math.max.apply(null, top.map(function (x) { return x.m; })));
    var zoom = top.length > PARETO_WINDOW;
    var el = $("chPar"); if (el) el.style.height = (zoom ? 356 : 330) + "px";
    try { c.resize(); } catch (e) {}

    c.setOption({
      grid: { left: 16, right: 44, top: 22, bottom: zoom ? 52 : 6, containLabel: true },
      legend: { show: false },
      dataZoom: zoom ? [
        { type: "inside", startValue: 0, endValue: PARETO_WINDOW - 1, minValueSpan: 3, zoomOnMouseWheel: false, moveOnMouseWheel: true },
        {
          type: "slider", bottom: 10, height: 14,
          startValue: 0, endValue: PARETO_WINDOW - 1, minValueSpan: 3,
          /* rãnh trượt mảnh, trung tính; bỏ hẳn biểu đồ sóng nền của ECharts */
          backgroundColor: "#F1F5F9", borderColor: "transparent", borderRadius: 7,
          fillerColor: "rgba(100,116,139,.18)",
          showDataShadow: false, showDetail: false, brushSelect: false,
          moveHandleSize: 0, labelFormatter: "",
          /* hai đầu cùng tông với vệt chọn → nhìn như một thanh cuộn bo tròn liền
             mạch, vẫn kéo được để đổi độ rộng cửa sổ */
          handleSize: "100%",
          handleIcon: "path://M3,0 h4 a3,3 0 0 1 3,3 v14 a3,3 0 0 1 -3,3 h-4 a3,3 0 0 1 -3,-3 v-14 a3,3 0 0 1 3,-3 z",
          handleStyle: { color: "#94A3B8", borderWidth: 0, shadowBlur: 0 },
          emphasis: { handleStyle: { color: "#64748B" } }
        }
      ] : [],
      xAxis: {
        type: "category", data: top.map(function (x) { return x.k; }),
        axisLabel: {
          color: CLR.INK3, fontSize: 10.5, interval: 0, rotate: 24, margin: 11,
          width: 112, overflow: "truncate", ellipsis: "…", align: "right", verticalAlign: "top"
        },
        axisTick: { show: false }, axisLine: { lineStyle: { color: CLR.LINE } }
      },
      yAxis: [
        { type: "value",
          name: "[" + scP.u.trim() + "]", nameLocation: "end", nameGap: 10, nameRotate: 0,
          nameTextStyle: { color: CLR.INK3, fontSize: 10.5, fontWeight: 600, align: "left" },
          axisLabel: { formatter: function (v) { return axisFmt(scP)(v).replace(scP.u, ""); }, color: CLR.INK3, fontSize: 11 },
          splitLine: { lineStyle: { color: CLR.LINE, type: "dashed" } } },
        { type: "value", max: 100, min: 0, axisLabel: { formatter: "{value}%", color: CLR.INK3, fontSize: 11 },
          splitLine: { show: false } }
      ],
      tooltip: Object.assign({
        trigger: "axis", axisPointer: { type: "shadow" },
        formatter: function (ps) {
          var i = ps[0].dataIndex, x = top[i];
          return tt(x.k, T("dash.nOpps", { n: x.n }), [
            { k: metric === "vol" ? T("common.volume") : T("common.value"), v: fmtM(x.m), c: CLR.PRI },
            { k: T("dash.share"), v: (x.m / grand * 100).toFixed(1).replace(".", I18N.decSep()) + "%" },
            { k: T("dash.cumulative"), v: String(cum[i]).replace(".", I18N.decSep()) + "%", c: "#B45309" }
          ], i <= idx80 && idx80 >= 0 ? T("dash.in80") : "");
        }
      }, TT_BOX),
      series: [
        {
          type: "bar", barMaxWidth: 34, cursor: "pointer",
          itemStyle: { borderRadius: [5, 5, 0, 0] },
          emphasis: { itemStyle: HOVER },
          blur: BLUR,
        blur: BLUR,
          data: top.map(function (x, i) {
            var col = (i <= idx80 || idx80 < 0) ? CLR.PRI : "#9BB6C9";
            return { value: x.m, itemStyle: { color: col }, emphasis: { itemStyle: { color: lift(col) } } };
          }),
          animationDuration: 420, animationDurationUpdate: 260
        },
        {
          type: "line", yAxisIndex: 1, smooth: false, symbol: "circle", symbolSize: 6,
          lineStyle: { width: 2, color: "#B45309" }, itemStyle: { color: "#B45309" },
          emphasis: { itemStyle: { color: lift("#B45309"), borderColor: "#fff", borderWidth: 2 } },
          blur: BLUR,
          data: cum,
          markLine: {
            /* animation:false — nếu không, mỗi lần lọc lại đường 80% vẽ chạy
               ngang từ trái sang phải, rất nhiễu mắt */
            animation: false, silent: true, symbol: "none",
            lineStyle: { color: "#B45309", type: "dashed", width: 1.2 },
            label: { formatter: "80%", color: "#B45309", fontSize: 10.5, fontWeight: 700, position: "insideEndTop" },
            data: [{ yAxis: 80 }]
          },
          animationDuration: 460, animationDurationUpdate: 260
        }
      ],
      textStyle: GRID_F
    }, true);
    c.off("click");
    c.on("click", function (p) {
      var x = top[p.dataIndex]; if (x) cross("par", "product", x.k, x.k);
    });
  }

  /* ══════════ Chart 4 — Sunburst GBU → phân khúc ══════════
     Bấm vào một nhóm ngành → nhóm đó phủ trọn vòng trong, vòng ngoài là
     các phân khúc con của nó (drill-down). Bấm "← Tất cả nhóm" để quay ra. */
  var segRoot = null;

  function chSeg() {
    var c = ec("chSeg"); if (!c) return;
    var tree = {};
    rows("seg").forEach(function (r) {
      var g = r.group || "—", sg = r.segment || "—";
      tree[g] = tree[g] || { m: 0, n: 0, ch: {} };
      tree[g].m += mOf(r); tree[g].n++;
      tree[g].ch[sg] = tree[g].ch[sg] || { m: 0, n: 0 };
      tree[g].ch[sg].m += mOf(r); tree[g].ch[sg].n++;
    });
    var keys = Object.keys(tree).sort(function (a, b) { return tree[b].m - tree[a].m; });
    if (segRoot && keys.indexOf(segRoot) < 0) segRoot = null;     // nhóm đã bị lọc mất
    var back = $("segBack");
    if (back) { back.hidden = !segRoot; back.textContent = "← " + (segRoot ? T("dash.allGroups") : ""); }
    if (!keys.length) { c.clear(); return; }

    var shown = segRoot ? [segRoot] : keys;
    /* Tỉ trọng luôn tính trên tổng của phạm vi đang xem để nhãn % cộng lại = 100% */
    var grand = shown.reduce(function (t, k) { return t + tree[k].m; }, 0) || 1;
    var pct = function (v) { return (v / grand * 100); };
    var pi = 0;
    var data = shown.map(function (g) {
      var col = GBU_CLR[g] || SEG_PAL[keys.indexOf(g) % SEG_PAL.length] || SEG_PAL[pi++ % SEG_PAL.length];
      var chk = Object.keys(tree[g].ch).sort(function (a, b) { return tree[g].ch[b].m - tree[g].ch[a].m; });
      return {
        name: g, value: tree[g].m, itemStyle: { color: col }, _n: tree[g].n, _lv: 1,
        /* show:false mới thật sự tắt nhãn — formatter trả chuỗi rỗng sẽ bị
           ECharts thay bằng tên node và tràn ra ngoài lát hẹp. */
        label: { show: segRoot ? true : pct(tree[g].m) >= 4 },
        emphasis: { itemStyle: { color: lift(col), shadowBlur: 12, shadowColor: "rgba(11,36,54,.25)" } },
        children: chk.map(function (sg, i) {
          var op = Math.max(.42, .92 - i * 0.13);
          return {
            name: sg, value: tree[g].ch[sg].m, _n: tree[g].ch[sg].n, _lv: 2, _p: g,
            itemStyle: { color: col, opacity: op },
            label: { show: pct(tree[g].ch[sg].m) >= 5 },
            emphasis: { itemStyle: { color: lift(col), opacity: Math.min(1, op + .12), shadowBlur: 10, shadowColor: "rgba(11,36,54,.22)" } }
          };
        })
      };
    });

    c.setOption({
      tooltip: Object.assign({
        trigger: "item", formatter: function (p) {
          var d = p.data || {};
          return tt(d.name, d._lv === 2 ? T("dash.segmentOf", { g: d._p }) : T("common.segmentGroup"), [
            { k: metric === "vol" ? T("common.volume") : T("common.value"), v: fmtM(p.value), c: p.color },
            { k: T("dash.share"), v: pct(p.value).toFixed(1).replace(".", I18N.decSep()) + "%" },
            { k: T("dash.oppCount"), v: num(d._n || 0) }
          ], d._lv === 1 && !segRoot ? T("dash.drillHint") : "");
        }
      }, TT_BOX),
      series: [{
        blur: BLUR,
        type: "sunburst", radius: [segRoot ? "0%" : "16%", "94%"], center: ["50%", "52%"], sort: null, cursor: "pointer",
        nodeClick: false,
        emphasis: {},
        levels: [
          {},
          { r0: segRoot ? "0%" : "16%", r: "54%", itemStyle: { borderWidth: 2, borderColor: "#fff" },
            label: {
              rotate: segRoot ? 0 : "tangential", fontSize: segRoot ? 14 : 11, fontWeight: segRoot ? 800 : 700,
              color: "#fff", lineHeight: 15, overflow: "truncate", ellipsis: "…",
              width: segRoot ? 150 : 78, minAngle: 16,
              
              formatter: function (p) {
                if (segRoot) return p.name;                 // lát 360° → ECharts đặt đúng tâm
                var v = pct(p.value);
                return v < 9 ? v.toFixed(0) + "%" : p.name + "\n" + v.toFixed(0) + "%";
              }
            } },
          { r0: "55%", r: "90%", itemStyle: { borderWidth: 1.5, borderColor: "#fff" },
            label: {
              /* tangential khi đã drill (ít lát, cung rộng) — radial khi xem tổng thể */
              rotate: segRoot ? "tangential" : "radial", fontSize: 9.5, color: "#fff", fontWeight: 600,
              lineHeight: 11, width: segRoot ? 104 : 56, overflow: "truncate", ellipsis: "…", minAngle: 14,
              formatter: function (p) {
                var v = pct(p.value);
                return v < 9 ? v.toFixed(0) + "%" : p.name + "\n" + v.toFixed(0) + "%";
              }
            } }
        ],
        data: data,
        animationDuration: 380, animationDurationUpdate: 280, animationEasingUpdate: "cubicOut"
      }],
      textStyle: GRID_F
    }, true);
    c.off("click");
    c.on("click", function (p) {
      var d = p.data || {};
      if (d._lv === 2) { cross("seg", "seg", d.name, d._p + " | " + d.name); return; }
      if (d._lv === 1) {
        if (segRoot === d.name) { segUp(); return; }          // bấm lại vòng trong → quay ra
        segRoot = d.name;
        cross("seg", "gbu", d.name, d.name);                   // cross() đã gọi paint()
      }
    });
  }
  function segUp() { segRoot = null; if (X && X.type === "gbu") { X = null; } paint(); }

  /* ══════════ Chart 5 — Pipeline theo PIC ══════════ */
  function chPic() {
    var c = ec("chPic"); if (!c) return;
    var rs = rows("pic");
    var byPic = {}, stages = [];
    rs.forEach(function (r) {
      var p = r.pic || "—", k = stageKey(r);
      byPic[p] = byPic[p] || { tot: 0, s: {} };
      byPic[p].tot += mOf(r);
      byPic[p].s[k] = (byPic[p].s[k] || 0) + mOf(r);
      if (stages.indexOf(k) < 0) stages.push(k);
    });
    var pics = Object.keys(byPic).sort(function (a, b) { return byPic[a].tot - byPic[b].tot; });
    if (!pics.length) { c.clear(); return; }
    var ORD = allNcc() ? ["Tiếp cận", "Thử mẫu", "Đàm phán", "Hoãn"] : [];
    if (!ORD.length) { try { ORD = pipelineOf(nccFilter); } catch (e) { ORD = []; } }
    ORD = ORD.concat(["WON", "LOST"]);
    function ordIdx(k) {
      var i = ORD.indexOf(k);
      if (i < 0) i = ORD.indexOf(STAGE_GROUP[k] || k);
      return i < 0 ? 99 : i;
    }
    stages.sort(function (a, b) { return ordIdx(a) - ordIdx(b); });
    var scC = axisScale(Math.max.apply(null, pics.map(function (p) { return byPic[p].tot; })));
    var h = Math.max(200, pics.length * 42 + 60);
    var el = $("chPic"); if (el) el.style.height = h + "px";
    try { c.resize(); } catch (e) {}

    c.setOption({
      grid: { left: 8, right: 60, top: 42, bottom: 6, containLabel: true },
      legend: {
        top: 0, left: 0, itemWidth: 10, itemHeight: 10, itemGap: 14,
        textStyle: { color: CLR.INK3, fontSize: 11, fontWeight: 600 },
        data: stages.map(stageLbl)
      },
      xAxis: {
        type: "value",
        name: "[" + scC.u.trim() + "]", nameLocation: "end", nameGap: 24,
        nameTextStyle: { color: CLR.INK3, fontSize: 10.5, fontWeight: 600, align: "center" },
        axisLabel: { formatter: function (v) { return axisFmt(scC)(v).replace(scC.u, ""); }, color: CLR.INK3, fontSize: 11 },
        splitLine: { lineStyle: { color: CLR.LINE, type: "dashed" } }, axisLine: { show: false }, axisTick: { show: false }
      },
      yAxis: {
        type: "category", data: pics, axisLabel: { color: CLR.INK, fontSize: 12, fontWeight: 600 },
        axisLine: { show: false }, axisTick: { show: false }
      },
      tooltip: Object.assign({
        trigger: "axis", axisPointer: { type: "shadow" },
        formatter: function (ps) {
          if (!ps.length) return "";
          var p = pics[ps[0].dataIndex];
          var lines = ps.filter(function (x) { return x.value > 0; }).map(function (x) {
            return { k: x.seriesName, v: fmtM(x.value), c: x.color };
          });
          lines.push({ k: T("dash.period.both"), v: fmtM(byPic[p].tot) });
          return tt(p, T("common.ownerFull"), lines);
        }
      }, TT_BOX),
      series: stages.map(function (k, i) {
        return {
          name: stageLbl(k), type: "bar", stack: "s", barMaxWidth: 22, cursor: "pointer",
          itemStyle: { color: stageColor(k), borderRadius: i === stages.length - 1 ? [0, 4, 4, 0] : 0 },
          emphasis: { itemStyle: Object.assign({ color: lift(stageColor(k)) }, HOVER) },
          blur: BLUR,
          data: pics.map(function (p) { return byPic[p].s[k] || 0; }),
          animationDuration: 420, animationDurationUpdate: 260
        };
      }),
      textStyle: GRID_F
    }, true);
    c.off("click");
    c.on("click", function (p) {
      var name = pics[p.dataIndex]; if (name) cross("pic", "pic", name, name);
    });
  }

  /* ══════════ Bảng chi tiết ══════════ */
  var COLS = [
    { k: "st", get t() { return T("dash.col.st"); }, w: "58px" },
    { k: "cust", get t() { return T("dash.col.accountProduct"); } },
    { k: "seg", get t() { return T("common.segment"); } },
    { k: "app", get t() { return T("common.application"); } },
    { k: "stage", get t() { return T("common.stage"); } },
    { k: "prob", get t() { return T("sf.probability"); } },
    { k: "vol", get t() { return T("common.volume"); }, num: 1 },
    { k: "val", get t() { return T("common.value"); }, num: 1 },
    { k: "pic", get t() { return T("common.owner"); } }
  ];
  function sortVal(r, k) {
    switch (k) {
      case "st": return r.status === "WON" ? 2 : r.status === "LOST" ? 0 : 1;
      case "cust": return (r.customer || "").toLowerCase();
      case "seg": return segFull(r).toLowerCase();
      case "app": return (r.application || "").toLowerCase();
      case "stage": return stageKey(r);
      case "prob": return r.prob || 0;
      case "vol": return volOf(r);
      case "val": return valOf(r);
      case "pic": return (r.pic || "").toLowerCase();
      default: return mOf(r);
    }
  }
  function renderTable(rs) {
    var box = $("sfTbl"); if (!box) return;
    var list = rs.slice().sort(function (a, b) {
      var x = sortVal(a, sortBy), y = sortVal(b, sortBy);
      if (x === y) return mOf(b) - mOf(a);
      return (x > y ? 1 : -1) * sortDir;
    });
    var shown = list.slice(0, TABLE_MAX);
    var sub = $("tblSub");
    if (sub) sub.textContent = list.length
      ? T("dash.nOpps", { n: num(list.length) }) + " · " + fmtM(list.reduce(function (s, r) { return s + mOf(r); }, 0)) +
        (list.length > TABLE_MAX ? " · " + T("dash.showingFirst", { n: TABLE_MAX }) : "")
      : T("common.noData");

    if (!shown.length) {
      box.innerHTML = '<div class="sf-dempty"><b>' + T("common.noData") + '</b>' + T("dash.emptyHint") + '</div>';
      return;
    }
    var head = "<tr>" + COLS.map(function (c) {
      return '<th class="' + (c.num ? "num " : "") + (sortBy === c.k ? "srt" : "") + '"' +
        (c.w ? ' style="width:' + c.w + '"' : "") + ' onclick="SFD.sort(\'' + c.k + '\')">' + esc(c.t) +
        '<span class="ar">' + (sortBy === c.k ? (sortDir > 0 ? "▲" : "▼") : "↕") + "</span></th>";
    }).join("") + "</tr>";

    var body = shown.map(function (r) {
      var k = stageKey(r), pc = Math.round((r.prob || 0) * 100);
      return '<tr onclick="SFD.open(\'' + r.id + '\')" title="' + esc(T("dash.openOpp", { id: r.id })) + '">' +
        '<td><span class="sf-badge ' + (({ WON: "p-won", LOST: "p-lost" })[r.status] || "p-prog") + '">' +
          (r.status === "WON" ? T("dash.badge.won") : r.status === "LOST" ? T("dash.badge.lost") : T("dash.badge.open")) + "</span></td>" +
        '<td><span class="cust">' + esc(r.customer) + (isLate(r) ? '<span class="sf-late">' + T("dash.overdueLower") + '</span>' : "") +
          '</span><span class="sub">' + esc(r.product) + " · " + esc(r.id) + "</span></td>" +
        "<td>" + esc(segFull(r)) + "</td>" +
        "<td>" + esc(r.application || "—") + "</td>" +
        '<td><span class="sf-badge ' + stageCls2(k) + '">' + esc(stageLbl(k)) + "</span></td>" +
        '<td><span class="sf-prob"><i><b style="width:' + pc + "%;background:" + stageColor(k) + '"></b></i>' +
          "<span>" + pc + "%</span></span></td>" +
        '<td class="num">' + num(volOf(r)) + "</td>" +
        '<td class="num"' + (isEst(r) ? ' title="' + esc(T("dash.noPrice")) + '" style="color:var(--ink-3);font-weight:500"' : "") + ">" +
          (isEst(r) ? "—" : fmtVal(valOf(r))) + "</td>" +
        '<td><span class="sf-tav" style="background:' + picColor(r.pic) + '">' + esc(initials(r.pic)) + "</span>" +
          esc(r.pic || "—") + "</td></tr>";
    }).join("");
    box.innerHTML = '<table class="sf-tbl"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
  }

  /* ══════════ Chips cross-filter ══════════ */
  var XT = {
    get rec() { return T("common.opportunity"); }, get customer() { return T("common.account"); },
    get product() { return T("common.product"); }, get gbu() { return T("common.segmentGroup"); },
    get seg() { return T("common.segment"); }, get pic() { return T("common.owner"); },
    get stage() { return T("common.stage"); }, get status() { return T("common.status"); } };
  function renderChips() {
    var box = $("sfChips"); if (!box) return;
    var items = [];
    if (X) items.push({ t: XT[X.type] || T("common.filter"), v: X.type === "stage" ? stageLbl(X.value) : (X.label || X.value), on: "SFD.clearX()" });
    DD.forEach(function (d) {
      (F[d.k] || []).forEach(function (v) {
        items.push({ t: d.t, v: d.lab ? d.lab(v) : v, on: "SFD.pick('" + d.k + "'," + JSON.stringify(v).replace(/"/g, "&quot;") + ")" });
      });
    });
    box.hidden = !items.length;
    box.innerHTML = items.map(function (i) {
      return '<span class="sf-chip"><i>' + esc(i.t) + ":</i> " + esc(i.v) +
        '<button type="button" aria-label="' + esc(T("common.removeFilter")) + '" onclick="' + i.on + '">×</button></span>';
    }).join("");
    var rb = $("sfDReset"); if (rb) rb.hidden = !items.length;
  }

  /* ══════════ Vẽ lại toàn bộ ══════════ */
  var pending = null, pending2 = null;
  /* Thứ tự quan trọng: KPI + biểu đồ vẽ trước trong khung hình đầu, còn bảng chi
     tiết (tới 120 dòng × 9 ô) và 5 dropdown lọc — phần nặng nhất về DOM — đẩy
     sang khung hình sau. Trước đây bảng chạy TRƯỚC biểu đồ nên mỗi lần bấm vào
     Sunburst là main thread kẹt ~1s rồi chart mới nhúc nhích. */
  function paint() {
    if (!booted || !document.body.classList.contains("sf-view-dash")) return;
    if (typeof me === "undefined" || !me) return;
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(function () {
      var rs;
      try {
        renderChips();
        rs = rows(null);
        renderKPI(rs);
        if (window.echarts) { chTop(); chFun(); chPar(); chSeg(); chPic(); }
      } catch (e) { fail(e); return; }

      cancelAnimationFrame(pending2);
      pending2 = requestAnimationFrame(function () {
        try {
          renderTable(rs);
          var reopen = openDD;
          renderDD();
          if (reopen && $("dd_" + reopen)) { openDD = null; ddToggle(reopen, true); }
          ready = true;
        } catch (e) { fail(e); }
      });
    });
  }
  function fail(e) {
    var n = $("sfDNote");
    if (n) n.innerHTML = '<div class="sf-dnote err">' + T("dash.renderError") + " " + esc(e.message) + "</div>";
    if (window.console) console.error("[SFD]", e);
  }

  /* ══════════ i18n: re-render on EN | VI switch (keeps filters, metric & period) ══════════ */
  if (window.I18N) I18N.onChange(function () {
    var row = $("kpiRow"); if (row) { delete row.dataset.built; }
    paint();
  });

  /* ══════════ API công khai ══════════ */
  function show(on) {
    if (!mount()) return;
    document.body.classList.toggle("sf-view-dash", !!on);
    var a = $("vbList"), b = $("vbDash");
    if (a) { a.classList.toggle("on", !on); a.setAttribute("aria-pressed", String(!on)); }
    if (b) { b.classList.toggle("on", !!on); b.setAttribute("aria-pressed", String(!!on)); }
    try { localStorage.setItem("sf.view", on ? "dash" : "list"); } catch (e) {}
    if (on) { paint(); setTimeout(resizeAll, 60); }
  }
  function setPeriod(k) {
    if (!PERIODS[k] || period === k) return;
    period = k;
    ["both", "this", "next"].forEach(function (x) {
      var el = $("p" + x.charAt(0).toUpperCase() + x.slice(1));
      if (el) el.classList.toggle("on", x === k);
    });
    paint();
  }
  function setMetric(m) {
    if (metric === m) return;
    metric = m;
    var a = $("mVol"), b = $("mVal");
    if (a) a.classList.toggle("on", m === "vol");
    if (b) b.classList.toggle("on", m === "val");
    paint();
  }
  function pick(k, v) {
    var a = F[k] || (F[k] = []);
    var i = a.indexOf(v);
    if (i >= 0) a.splice(i, 1); else a.push(v);
    paint();
  }
  function all(k) {
    var d = DD.filter(function (x) { return x.k === k; })[0]; if (!d) return;
    F[k] = uniq(base().map(d.of));
    paint();
  }
  function none(k) { F[k] = []; paint(); }
  function cross(src, type, value, label) {
    if (X && X.type === type && X.value === value) X = null;
    else X = { src: src, type: type, value: value, label: label };
    paint();
  }
  function clearX() { X = null; paint(); }
  function reset() {
    F = { gbu: [], seg: [], stage: [], pic: [], status: [] };
    X = null; segRoot = null; paint();
  }
  function sort(k) {
    if (sortBy === k) sortDir = -sortDir; else { sortBy = k; sortDir = (k === "vol" || k === "val" || k === "prob") ? -1 : 1; }
    paint();
  }
  function open(id) {
    try { if (window.SF && SF.openRecord) SF.openRecord(id); } catch (e) {}
  }

  window.SFD = {
    show: show, setMetric: setMetric, setPeriod: setPeriod, pick: pick, all: all, none: none,
    dd: function (k) { ddToggle(k); }, reset: reset, clearX: clearX, sort: sort, open: open, segUp: segUp,
    refresh: paint, mount: mount
  };

  /* ══════════ Gắn vào vòng đời của trang danh sách ══════════ */
  function hook() {
    if (!window.SF || hook.done) return;
    hook.done = true;
    ["render", "setNcc", "setStatus", "saveRecord", "moveStage", "confirmClose", "saveAmount", "saveRisk", "saveTitle"]
      .forEach(function (m) {
        var f = SF[m]; if (typeof f !== "function") return;
        SF[m] = function () { var r = f.apply(this, arguments); paint(); return r; };
      });
  }
  function afterLogin() {
    try {
      mount(); hook();
      var want = false;
      try { want = localStorage.getItem("sf.view") === "dash"; } catch (e) {}
      try { want = want || /(?:^|[?&])view=dash(?:&|$)/.test(location.search); } catch (e) {}
      if (want) show(true);
    } catch (e) { if (window.console) console.error("[SFD] boot", e); }
  }
  function wrapLogin(fn) {
    if (typeof fn !== "function" || fn.__sfd) return fn;
    var w = function () { var r = fn.apply(this, arguments); afterLogin(); return r; };
    w.__sfd = 1;
    return w;
  }
  if (typeof window.loginAs === "function") {
    window.loginAs = wrapLogin(window.loginAs);
  } else {
    var _la;
    Object.defineProperty(window, "loginAs", {
      configurable: true,
      get: function () { return _la; },
      set: function (fn) { _la = wrapLogin(fn); }
    });
  }

  /* ECharts nạp từ CDN (có fallback) — chờ tối đa ~8s rồi vẽ lại một lần */
  (function waitEcharts() {
    var n = 0;
    var iv = setInterval(function () {
      if (window.echarts) { clearInterval(iv); if (booted) paint(); return; }
      if (++n > 40) { clearInterval(iv); if (booted) paint(); }
    }, 200);
  })();

  document.addEventListener("DOMContentLoaded", function () { mount(); hook(); });
  if (document.readyState !== "loading") { setTimeout(function () { mount(); hook(); }, 0); }
})();
