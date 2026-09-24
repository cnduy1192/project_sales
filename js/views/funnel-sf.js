/* ============================================================
   Sales Funnel — Customer-centric workspace
   Trang riêng salesfunnel.html. Tái dùng tầng data của app chính
   (catalog/config/insights/roles/store/auth) và tự render danh sách
   dự án theo khách hàng + Record Page. KHÔNG đụng DOM của index.html.
   ============================================================ */
(function () {
  "use strict";

  var statusFilter = "IN PROGRESS";   // IN PROGRESS | WON | LOST
  var curId = null;                   // record đang mở
  var closePick = null;
  var expanded = {};                  // KH nào đang bung project (cây thư mục)

  /* ---------- toast (trang riêng, không phụ thuộc modal của index) ---------- */
  var _toastT;
  function toast(m) {
    var t = document.getElementById("toastEl"); if (!t) { return; }
    t.textContent = m; t.style.display = "block";
    clearTimeout(_toastT); _toastT = setTimeout(function () { t.style.display = "none"; }, 4600);
  }
  window.toast = toast;

  /* ---------- helpers ---------- */
  function fmt(n) { return (n || 0).toLocaleString(I18N.locale()); }
  function initials(n) { return String(n || "?").trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase(); }
  function colorOf(pic) { var u = USERS.find(function (x) { return x.pic === pic; }); return u ? u.color : "#4A5F70"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function viDate(d) {
    if (!d) return "—";
    var x = new Date(d); if (isNaN(x)) return "—";
    return String(x.getDate()).padStart(2, "0") + "/" + String(x.getMonth() + 1).padStart(2, "0") + "/" + x.getFullYear();
  }
  function probPct(r) { return Math.round((r.prob || 0) * 100); }
  function stageShort(s) {
    return String(s || "").replace("SHARED BUSINESS GOAL", "SHARED GOAL").replace("BUILDING A SOLUTION", "BUILDING")
      .replace("SOLUTION TESTING", "TESTING").replace("OFFER & AGREEMENT", "OFFER").replace("QUOTED / PO", "QUOTED/PO")
      .replace("TEST PASSED", "PASSED");
  }
  // DD/MM/YYYY — toLocaleDateString("vi-VN") cho ra "5/8/2026", không đủ 2 chữ số
  function dmy(d) {
    if (!d || isNaN(d)) return "";
    return String(d.getDate()).padStart(2, "0") + "/" +
      String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  }
  function nowStamp() {
    var d = new Date();
    return dmy(d) + " " + d.toTimeString().slice(0, 5);
  }
  function recById(id) { return RECORDS.find(function (r) { return r.id === id; }); }

  function inScope(r) { return !nccFilter || isAllNcc() || r.ncc === nccFilter; }
  function scoped() { return scopeRecords(RECORDS.filter(inScope), me); }
  function searchQ() { return (document.getElementById("sfQ").value || "").toLowerCase().trim(); }
  function matchQ(r, q) { return !q || (r.customer + " " + r.product + " " + r.application + " " + (r.pic || "")).toLowerCase().indexOf(q) >= 0; }

  function isLate(r) { return r.status === "IN PROGRESS" && r.closing && new Date(r.closing) < TODAY; }
  function isMac() { return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ""); }

  /* ============================================================
     BOOT — loginAs override (auth.js gọi khi đã xác thực)
     ============================================================ */
  function loginAs(i) {
    me = USERS[i];
    if (!me) return;
    nccFilter = ALL_NCC;   // mặc định xem Tất cả nhà cung cấp
    applyDeepLink();       // ?ncc=&status=&q=&open= từ menu Sales Funnel ở index.html
    document.getElementById("sfLogin").style.display = "none";
    document.getElementById("sfApp").style.display = "flex";
    renderUser();
    renderNccTabs();
    render();
  }
  window.loginAs = loginAs;

  /* ---------- Deeplink: salesfunnel.html?ncc=…&status=…&q=…&open=<mã dự án> ---------- */
  var DL = (function () {
    try {
      var p = new URLSearchParams(location.search);
      return { ncc: p.get("ncc") || "", status: p.get("status") || "", q: p.get("q") || "", open: p.get("open") || "" };
    } catch (e) { return {}; }
  })();
  var dlOpened = false;
  function applyDeepLink() {
    if (DL.ncc) {
      var k = DL.ncc.trim().toLowerCase();
      nccFilter = NCCS.filter(function (n) { return n.toLowerCase() === k; })[0] || DL.ncc.trim();
    }
    if (DL.status === "IN PROGRESS" || DL.status === "WON" || DL.status === "LOST") {
      statusFilter = DL.status;
      document.querySelectorAll("#sfStatusSeg .sf-seg-b").forEach(function (b) { b.classList.toggle("on", b.dataset.st === statusFilter); });
    }
    var qi = document.getElementById("sfQ");
    if (DL.q && qi) qi.value = DL.q;
    if (DL.open && !dlOpened) {
      dlOpened = true;
      var tries = 0;
      var iv = setInterval(function () {   // chờ dữ liệu SharePoint về rồi mới mở record
        tries++;
        if (recById(DL.open)) { clearInterval(iv); openRecord(DL.open); }
        else if (tries > 120) { clearInterval(iv); toast(T("sf.msg.dlNotFound", { id: DL.open })); }
      }, 300);
    }
  }

  // auth.js expects these to exist when it renders index chrome — no-op here.
  window.rebuildNccTabs = function () { try { renderNccTabs(); } catch (e) {} };
  window.render = function () { try { render(); } catch (e) {} };
  window.buildForm = function () {};
  window.buildUsers = function () {};

  function renderUser() {
    var el = document.getElementById("sfUser");
    el.textContent = initials(me.name);
    el.style.background = me.color || "#01426A";
    el.title = me.name + " · " + roleLabel(me.role);
  }

  /* ============================================================
     NCC — custom listbox (native select không cho style popup và
     mũi tên không bắt được click). Bấm đâu trong khung cũng mở.
     ============================================================ */
  var NCC_IC = '<svg class="sf-ncc-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 21V11"/></svg>';
  var NCC_CV = '<svg class="sf-ncc-cv" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  var NCC_CK = '<svg class="ck" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5.2 5.2L20 7"/></svg>';

  function nccLabel(v) { return v === ALL_NCC ? T("sf.allSuppliers") : v; }
  function nccCount(v) {
    var all = scopeRecords(RECORDS, me) || [];
    return (v === ALL_NCC ? all : all.filter(function (r) { return r.ncc === v; })).length;
  }

  function renderNccTabs() {
    var box = document.getElementById("sfNcc"); if (!box) return;
    var open = box.classList.contains("open");
    var items = [ALL_NCC].concat((typeof supplierOptions === "function") ? supplierOptions() : NCCS);
    var opts = items.map(function (v, i) {
      var on = (v === ALL_NCC) ? isAllNcc() : (v === nccFilter);
      return (i === 1 ? '<div class="sf-ncc-sep"></div>' : "") +
        '<div class="sf-ncc-opt' + (on ? " on" : "") + '" role="option" tabindex="-1" aria-selected="' + on +
        '" data-v="' + esc(v) + '">' + NCC_CK +
        '<span class="lb">' + esc(nccLabel(v)) + "</span>" +
        '<span class="n">' + nccCount(v) + "</span></div>";
    }).join("");

    box.className = "sf-ncc" + (isAllNcc() ? "" : " filtered") + (open ? " open" : "");
    box.innerHTML =
      '<button type="button" class="sf-ncc-btn" id="sfNccBtn" aria-haspopup="listbox" aria-expanded="' + open +
        '" aria-controls="sfNccPop" aria-label="' + esc(T("common.supplier")) + ': ' + esc(nccLabel(nccFilter)) + '">' +
        NCC_IC + '<span class="sf-ncc-val">' + esc(nccLabel(nccFilter)) + "</span>" + NCC_CV + "</button>" +
      '<div class="sf-ncc-pop" id="sfNccPop" role="listbox" aria-label="' + esc(T("sf.pickSupplier")) + '"' + (open ? "" : " hidden") + ">" +
        opts + "</div>";
  }

  function nccOpen(on) {
    var box = document.getElementById("sfNcc"), pop = document.getElementById("sfNccPop"), btn = document.getElementById("sfNccBtn");
    if (!box || !pop || !btn) return;
    box.classList.toggle("open", on);
    pop.hidden = !on;
    btn.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) { var f = pop.querySelector(".sf-ncc-opt.on") || pop.querySelector(".sf-ncc-opt"); if (f) f.focus(); }
  }
  function nccIsOpen() { var pop = document.getElementById("sfNccPop"); return !!pop && !pop.hidden; }
  function nccPick(v) {
    nccOpen(false);
    setNcc(v);
    var btn = document.getElementById("sfNccBtn"); if (btn) btn.focus();
  }

  function setNcc(n) { nccFilter = n; renderNccTabs(); render(); }

  (function bindNcc() {
    var box = document.getElementById("sfNcc"); if (!box) return;

    box.addEventListener("click", function (e) {
      var opt = e.target.closest(".sf-ncc-opt");
      if (opt) { nccPick(opt.dataset.v); return; }
      if (e.target.closest(".sf-ncc-btn")) nccOpen(!nccIsOpen());
    });

    box.addEventListener("keydown", function (e) {
      var pop = document.getElementById("sfNccPop"); if (!pop) return;
      var opts = [].slice.call(pop.querySelectorAll(".sf-ncc-opt"));
      var i = opts.indexOf(document.activeElement);

      if (e.key === "Escape" && nccIsOpen()) {
        e.preventDefault(); e.stopPropagation();
        nccOpen(false); document.getElementById("sfNccBtn").focus(); return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!nccIsOpen()) { nccOpen(true); return; }
        var k = e.key === "ArrowDown" ? (i + 1) % opts.length : (i <= 0 ? opts.length - 1 : i - 1);
        opts[k].focus(); return;
      }
      if (nccIsOpen() && (e.key === "Home" || e.key === "End")) {
        e.preventDefault(); opts[e.key === "Home" ? 0 : opts.length - 1].focus(); return;
      }
      if (e.key === "Enter" || e.key === " ") {
        var o = e.target.closest(".sf-ncc-opt");
        if (o) { e.preventDefault(); nccPick(o.dataset.v); }
      }
    });

    document.addEventListener("click", function (e) { if (nccIsOpen() && !e.target.closest("#sfNcc")) nccOpen(false); });
    document.addEventListener("focusin", function (e) { if (nccIsOpen() && !e.target.closest("#sfNcc")) nccOpen(false); });
  })();
  function setStatus(st) {
    statusFilter = st;
    document.querySelectorAll("#sfStatusSeg .sf-seg-b").forEach(function (b) { b.classList.toggle("on", b.dataset.st === st); });
    render();
  }

  /* ============================================================
     RENDER workspace
     ============================================================ */
  function render() {
    if (!me) return;
    var q = searchQ();
    var pool = scoped().filter(function (r) { return matchQ(r, q); });
    var rows = pool.filter(function (r) { return r.status === statusFilter; });
    renderStats(pool);                        // số đếm hiển thị ngay trên tab trạng thái
    if (q) rows.forEach(function (r) { expanded[r.customer || "—"] = true; });   // tìm kiếm → tự bung
    syncExpandBtn(rows);

    var list = document.getElementById("sfList"), empty = document.getElementById("sfEmpty");
    if (!rows.length) {
      list.hidden = true; empty.hidden = false;
      empty.innerHTML =
        '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/></svg>' +
        "<b>" + T("sf.empty.title") + "</b><span>" + T("sf.empty.hint") + "</span>";
      return;
    }
    empty.hidden = true; list.hidden = false;
    renderList(rows);
  }

  // Số lượng dự án theo trạng thái — hiển thị ngay trên tab (đã bỏ dải thẻ KPI)
  function renderStats(all) {
    document.querySelectorAll("#sfStatusSeg .sf-seg-n").forEach(function (el) {
      var st = el.dataset.n;
      el.textContent = all.filter(function (r) { return r.status === st; }).length;
    });
  }

  // nhãn nút "Mở rộng / Thu gọn tất cả"
  function syncExpandBtn(rows) {
    var btn = document.getElementById("sfExpandAll"); if (!btn) return;
    var names = uniq(rows.map(function (r) { return r.customer || "—"; }));
    var allOpen = names.length > 0 && names.every(function (n) { return !!expanded[n]; });
    btn.textContent = allOpen ? T("sf.collapseAll") : T("sf.expandAll");
  }

  function toggleAll() {
    var q = searchQ();
    var rows = scoped().filter(function (r) { return matchQ(r, q); })
                       .filter(function (r) { return r.status === statusFilter; });
    var names = uniq(rows.map(function (r) { return r.customer || "—"; }));
    var anyClosed = names.some(function (n) { return !expanded[n]; });
    names.forEach(function (n) { expanded[n] = anyClosed; });
    render();
  }

  function uniq(a) {
    var s = {}, o = [];
    (a || []).forEach(function (x) { x = String(x == null ? "" : x).trim(); if (x && !s[x.toLowerCase()]) { s[x.toLowerCase()] = 1; o.push(x); } });
    return o;
  }
  function jsq(s) { return "'" + String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'"; }
  function titleCase(x) {
    return String(x || "").toLowerCase()
      .replace(/(^|[\s\/&-])([a-z\u00e0-\u1ef9])/g, function (m, sep, ch) { return sep + ch.toUpperCase(); })
      .replace("/Po", "/PO");
  }
  // class màu pill/chấm theo giai đoạn (WON/LOST dùng màu trạng thái)
  function pillCls(stage) { return stage === "WON" ? "p-won" : stage === "LOST" ? "p-lost" : stageCls(stage); }
  function grpCls(stage) { return pillCls(stage).replace("p-", "g-"); }
  function moneyStr(n) { return (n == null || n === "") ? "—" : groupNum(n) + " \u20ab"; }
  function avHTML(pic, title) {
    return '<span class="sf-av" style="background:' + colorOf(pic) + '" title="' + esc(title || pic || "—") + '">' + initials(pic) + "</span>";
  }
  function groupNum(n) { return (Number(n) || 0).toLocaleString(I18N.locale()); }   // 1.500.000.000
  function amountStr(r) { return (r.amount != null && r.amount !== "") ? groupNum(r.amount) : "—"; }

  /* ============================================================
     MASTER → DETAIL: mỗi khách hàng 1 hàng cha, bung ra các dự án con
     Hàng cha và hàng con dùng chung lưới 7 cột (xem funnel-sf.css)
     ============================================================ */
  function renderList(rows) {
    var box = document.getElementById("sfList");
    var map = {}, order = [];
    rows.forEach(function (r) { var k = r.customer || "—"; if (!map[k]) { map[k] = []; order.push(k); } map[k].push(r); });

    var head = '<div class="sf-ct-head">' +
      "<div>" + T("sf.col.accountOpp") + "</div>" +
      "<div>" + T("common.supplierShort") + "</div>" +
      "<div>" + T("sf.col.segmentProduct") + "</div>" +
      "<div>" + T("sf.col.stageClose") + "</div>" +
      "<div>" + T("sf.col.volume") + "</div>" +
      "<div>" + T("sf.col.value") + "</div>" +
      "<div>" + T("common.owner") + "</div></div>";

    var groups = order.map(function (k) { return summarize(k, map[k]); })
      .sort(function (a, b) { return b.amount - a.amount || a.name.localeCompare(b.name, "vi"); });

    var totKg = 0, totAmt = 0, totDeal = 0;
    var body = groups.map(function (g) {
      totKg += g.kg; totAmt += g.amount; totDeal += g.items.length;
      return '<div class="sf-ct-group">' + parentRow(g) + (expanded[g.name] ? childTable(g.items) : "") + "</div>";
    }).join("");

    var foot = '<div class="sf-ct-foot">' +
      '<div class="sf-ct-foot-l">' + T("common.total") + ' <span>· ' + T("sf.nAccounts", { n: groups.length }) + " · " + T("sf.nOpps", { n: totDeal }) + "</span></div>" +
      "<div></div><div></div><div></div>" +
      '<div class="sf-num">' + fmt(totKg) + " <small>KG</small></div>" +
      '<div class="sf-num">' + moneyStr(totAmt) + "</div><div></div></div>";

    box.innerHTML = head + body + foot;
  }

  // gộp số liệu 1 khách hàng
  function summarize(name, ps) {
    var items = ps.slice().sort(function (a, b) { return (a.closing || "9999") < (b.closing || "9999") ? -1 : 1; });
    var kg = 0, amount = 0, byStage = {}, byGroup = {}, byPic = {};
    items.forEach(function (r) {
      kg += Number(r.kgThis) || 0;
      amount += Number(r.amount) || 0;
      byStage[r.stage] = (byStage[r.stage] || 0) + 1;
      if (r.group) byGroup[r.group] = (byGroup[r.group] || 0) + 1;
      if (r.pic) byPic[r.pic] = (byPic[r.pic] || 0) + 1;
    });
    var owner = (typeof customerOwnerOf === "function" && customerOwnerOf(name)) || topKey(byPic) || items[0].pic || "—";
    return {
      name: name, items: items, kg: kg, amount: amount,
      nccs: uniq(items.map(function (r) { return r.ncc; })),
      group: topKey(byGroup),
      stages: Object.keys(byStage).map(function (st) { return { stage: st, n: byStage[st] }; })
        .sort(function (a, b) { return b.n - a.n || a.stage.localeCompare(b.stage); }),
      pic: owner,
      late: items.some(isLate)
    };
  }
  function topKey(o) {
    var k = Object.keys(o); if (!k.length) return "";
    k.sort(function (a, b) { return o[b] - o[a] || a.localeCompare(b, "vi"); });
    return k[0];
  }

  /* ---------- HÀNG CHA: KHÁCH HÀNG (không hiển thị ngày tháng) ---------- */
  function parentRow(g) {
    var open = !!expanded[g.name];
    var nccs = g.nccs.join(", ") || "—";
    var prog = g.stages.map(function (x) {
      return '<span class="sf-pg ' + grpCls(x.stage) + '"><span class="dot"></span><b>' + x.n + "</b>" +
        "<span>" + esc(titleCase(stageShort(x.stage))) + "</span></span>";
    }).join("") || "—";

    return '<div class="sf-ct-row' + (open ? " open" : "") + '" role="button" tabindex="0" aria-expanded="' + open + '"' +
      ' onclick="SF.toggleCustomer(' + jsq(g.name) + ')"' +
      ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();SF.toggleCustomer(' + jsq(g.name) + ')}">' +

      '<div class="sf-ct-cust">' +
        '<span class="sf-ct-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>' +
        "<b>" + esc(g.name) + "</b>" +
        '<span class="sf-ct-count">' + T("sf.nOpps", { n: g.items.length }) + "</span>" +
        (g.late ? '<span class="sf-ct-late">' + T("sf.overdue") + '</span>' : "") +
      "</div>" +

      '<div class="sf-ct-ncc" title="' + esc(nccs) + '">' + esc(nccs) + "</div>" +
      '<div><span class="sf-ct-grp">' + esc(g.group || "—") + "</span></div>" +
      '<div class="sf-ct-prog">' + prog + "</div>" +
      '<div class="sf-ct-kg">' + fmt(g.kg) + " <small>KG</small></div>" +
      '<div class="sf-ct-amt">' + moneyStr(g.amount) + "</div>" +
      '<div class="sf-ct-pic">' + avHTML(g.pic) + "</div>" +
      "</div>";
  }

  /* ---------- HÀNG CON: DỰ ÁN CỦA KHÁCH HÀNG ĐÓ ---------- */
  function childTable(ps) {
    var body = ps.map(function (r) {
      var late = isLate(r);
      return '<div class="sf-cc-row" role="button" tabindex="0"' +
        ' onclick="SF.openRecord(' + jsq(r.id) + ')"' +
        ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();SF.openRecord(' + jsq(r.id) + ')}">' +

        '<div class="sf-cc-proj"><b>' + esc(r.id) + "</b>" +
          '<span class="pill ' + pillCls(r.stage) + ' sf-cc-stage"><span class="dot"></span>' + esc(stageShort(r.stage)) + "</span></div>" +

        '<div class="sf-cc-ncc">' + esc(r.ncc || "—") + "</div>" +

        "<div><div class=\"sf-cc-prod\" title=\"" + esc(r.product || "") + "\">" + esc(r.product || "—") + "</div>" +
          '<div class="sf-cc-app" title="' + esc(r.application || "") + '">' + esc(r.application || "—") + "</div></div>" +

        '<div class="sf-cc-due' + (late ? " late" : "") + '">' + T("sf.dueLabel") + ' <b>' + viDate(r.closing) + "</b></div>" +

        '<div class="sf-num">' + fmt(r.kgThis) + " <small>KG</small></div>" +
        '<div class="sf-num">' + moneyStr(r.amount) + "</div>" +
        '<div class="sf-ct-pic">' + avHTML(r.pic) + "</div>" +
        "</div>";
    }).join("");
    return '<div class="sf-cc-wrap">' + body + "</div>";
  }

  function toggleCustomer(k) { expanded[k] = !expanded[k]; render(); }

  /* ============================================================
     Đổi giai đoạn (dùng bởi stepper ở Record Page)
     ============================================================ */
  function moveStage(id, stage) {
    var r = recById(id); if (!r || !stage || r.stage === stage) return;
    if (!capEdit(r, me) || r.status !== "IN PROGRESS") { toast(T("sf.msg.noStagePerm")); return; }
    var oldStage = r.stage, oldProb = r.prob;
    r.stage = stage;
    if (STAGE_PROB && STAGE_PROB[stage] != null) r.prob = STAGE_PROB[stage] / 100;
    render();
    if (curId === id) buildRecord();
    persist(r, { Stage: stage, WinProbability: probPct(r) },
      "[Giai đoạn] " + stageShort(oldStage) + " → " + stageShort(stage),
      T("sf.msg.stageMoved", { name: r.customer + " · " + r.product, stage: stageShort(stage) }),
      function () { r.stage = oldStage; r.prob = oldProb; render(); });
  }

  /* ghi SharePoint (nếu đã đăng nhập). Rollback khi lỗi. */
  function persist(r, patch, logText, okMsg, rollback) {
    if (!r.spId || !window.FISG_STORE || !FISG_STORE.canWrite || !FISG_STORE.canWrite()) {
      toast(okMsg + " " + T("sf.msg.notSynced")); return;
    }
    FISG_STORE.updateProject(r.spId, patch).then(function () {
      if (logText) { r.comments = r.comments || []; r.comments.push({ by: me.pic || me.name, at: nowStamp(), text: logText }); }
      if (logText) FISG_STORE.addProjectUpdate(r.spId, logText, me.pic || me.name, todayISO()).catch(function () {});
      toast(okMsg);
    }).catch(function (e) {
      if (rollback) rollback();
      toast(T("sf.msg.saveFailed") + " " + (e.message || e));
    });
  }

  /* ============================================================
     RECORD PAGE
     ============================================================ */
  function openRecord(id) {
    var r = recById(id); if (!r) return;
    curId = id;
    buildRecord();
    document.getElementById("sfRecBd").classList.add("open");
    document.getElementById("sfRec").classList.add("open");
    document.getElementById("sfRec").focus();
  }
  function closeRecord() {
    curId = null;
    document.getElementById("sfRecBd").classList.remove("open");
    document.getElementById("sfRec").classList.remove("open");
  }

  function buildRecord() {
    var r = recById(curId); if (!r) return;
    var el = document.getElementById("sfRec");
    var editable = capEdit(r, me) && r.status === "IN PROGRESS";
    var stClass = r.status === "WON" ? "won" : r.status === "LOST" ? "lost" : "run";

    el.innerHTML =
      headerHTML(r, stClass) +
      pathHTML(r, editable) +
      '<div class="sf-rec-split">' +
        '<div class="sf-rec-left">' +
          '<div class="sf-rec-main">' +
            titleHTML(r) +
            progressHTML(r, editable) +
            composerHTML(r) +
            timelineHTML(r) +
          "</div>" +
        "</div>" +
        '<aside class="sf-rec-side">' + sideHTML(r, editable) + "</aside>" +
      "</div>" +
      footHTML(r, editable);
  }

  /* Top header — chỉ định danh & hành động: ← Danh sách · mã dự án (copy) · badge trạng thái · × */
  var LIFE = [
    { k: "OPEN", get t() { return T("status.inProgress"); }, get h() { return T("sf.life.openHint"); }, c: "run" },
    { k: "WON", get t() { return T("status.won"); }, get h() { return T("sf.life.wonHint"); }, c: "won" },
    { k: "LOST", get t() { return T("status.lost"); }, get h() { return T("sf.life.lostHint"); }, c: "lost" },
    { k: "HOLD", get t() { return T("status.onHold"); }, get h() { return T("sf.life.holdHint"); }, c: "hold" }
  ];
  function lifeKey(r) {
    if (r.status === "WON") return "WON";
    if (r.status === "LOST") return "LOST";
    return r.onHold ? "HOLD" : "OPEN";
  }
  /* Dropdown vòng đời dự án — thay cho badge tĩnh + nút "Đóng dự án" ở footer */
  function statusSelectHTML(r, stClass, stLabel) {
    var curK = lifeKey(r);
    var canSet = capClose(r, me), canEdit = capEdit(r, me) || canSet;
    var cls = LIFE.filter(function (x) { return x.k === curK; })[0].c;
    var label = LIFE.filter(function (x) { return x.k === curK; })[0].t;
    if (!canSet && !canEdit) return '<span class="sf-stpill ' + cls + '">' + label + "</span>";
    var items = LIFE.map(function (x) {
      var on = x.k === curK;
      var allowed = x.k === "OPEN" ? (r.status === "IN PROGRESS" ? canEdit : canReopen(r))
        : x.k === "HOLD" ? (canEdit && r.status === "IN PROGRESS") : canSet;
      return '<button type="button" role="menuitemradio" aria-checked="' + on + '"' +
        ' class="sf-stopt ' + x.c + (on ? " on" : "") + '"' +
        (allowed && !on ? ' onclick="SF.setLifecycle(' + jsq(x.k) + ')"' : " disabled") +
        '><span class="dot"></span><span class="tx"><b>' + x.t + "</b><i>" + x.h + "</i></span>" +
        '<svg class="ck" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></button>';
    }).join("");
    return '<div class="sf-stsel" id="sfStSel">' +
      '<button type="button" class="sf-stpill ' + cls + ' sel" id="sfStBtn" aria-haspopup="menu" aria-expanded="false"' +
        ' onclick="SF.stMenu()" title="' + esc(T("sf.changeStatus")) + '"><span class="dot"></span>' + label +
        '<svg class="cv" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '<div class="sf-stpop" id="sfStPop" role="menu" hidden>' + items + "</div></div>";
  }
  function stMenu(force) {
    var box = document.getElementById("sfStSel"), pop = document.getElementById("sfStPop"),
        btn = document.getElementById("sfStBtn");
    if (!box || !pop) return;
    var on = force != null ? force : pop.hidden;
    pop.hidden = !on; box.classList.toggle("open", on);
    if (btn) btn.setAttribute("aria-expanded", String(on));
  }
  document.addEventListener("click", function (e) {
    if (!e.target.closest || e.target.closest(".sf-stsel")) return;
    stMenu(false);
  });
  /* Bắt ở pha capture: Esc khi menu đang mở chỉ đóng menu, không đóng cả record */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var pop = document.getElementById("sfStPop");
    if (pop && !pop.hidden) { stMenu(false); e.stopPropagation(); e.preventDefault(); }
  }, true);

  /* capClose() yêu cầu dự án đang chạy nên không dùng được cho thao tác MỞ LẠI.
     Dùng đúng bộ quyền đóng dự án nhưng bỏ điều kiện trạng thái. */
  function canReopen(r) {
    if (!r || !me || r.status === "IN PROGRESS") return false;
    var c = cap(me.role);
    if (!c.close) return false;
    if (c.scope === "all") return true;
    return !!me.pic && isMine(r.pic, me);
  }

  /* Đổi vòng đời. Thắng/Thua vẫn đi qua hộp thoại Đóng dự án để bắt nhập lý do. */
  function setLifecycle(k) {
    var r = recById(curId); if (!r) return;
    stMenu(false);
    if (k === "WON" || k === "LOST") {
      if (!capClose(r, me)) { toast(T('sf.msg.closeOnlyOwner')); return; }
      openClose(k); return;
    }
    if (k === "HOLD") {
      if (!capEdit(r, me)) { toast(T('sf.msg.noEditPerm')); return; }
      if (r.status !== "IN PROGRESS") { toast(T('sf.msg.reopenBeforeHold')); return; }
      r.onHold = true;
      buildRecord(); render();
      persist(r, { OnHold: true }, "[Tạm hoãn dự án]", T("sf.msg.putOnHold"), function () { r.onHold = false; buildRecord(); });
      return;
    }
    /* OPEN — bỏ tạm hoãn, hoặc mở lại dự án đã đóng */
    if (r.status === "IN PROGRESS") {
      if (!r.onHold) return;
      if (!capEdit(r, me)) { toast(T('sf.msg.noEditPerm')); return; }
      r.onHold = false;
      buildRecord(); render();
      persist(r, { OnHold: false }, "[Tiếp tục dự án]", T("sf.msg.resumed"), function () { r.onHold = true; buildRecord(); });
      return;
    }
    if (!canReopen(r)) { toast(T('sf.msg.reopenOnlyOwner')); return; }
    var prev = { status: r.status, prob: r.prob, closedAt: r.closedAt };
    r.status = "IN PROGRESS";
    r.prob = ((typeof STAGE_PROB !== "undefined" && STAGE_PROB[r.stage]) || 10) / 100;
    r.closedAt = null; r.onHold = false;
    buildRecord(); render();
    persist(r, { Status: "Open", Result: "", WinProbability: Math.round(r.prob * 100) },
      "[Mở lại dự án]", T("sf.msg.reopened"),
      function () { r.status = prev.status; r.prob = prev.prob; r.closedAt = prev.closedAt; buildRecord(); });
  }

  function headerHTML(r, stClass) {
    var stLabel = r.status === "WON" ? T("status.won") : r.status === "LOST" ? T("status.lost") : T("status.inProgress");
    return '<header class="sf-rec-head">' +
      '<button class="sf-rec-back" onclick="SF.closeRecord()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' + T("sf.backToList") + '</button>' +
      '<button class="sf-rec-code" onclick="SF.copyId(' + jsq(r.id) + ',this)" title="' + esc(T("sf.copyId")) + '">' + esc(r.id) +
        '<svg class="ic-copy" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>' +
        '<svg class="ic-ok" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></button>' +
      statusSelectHTML(r, stClass, stLabel) +
      (isLate(r) ? '<span class="sf-rec-late">' + T("sf.overdue") + '</span>' : "") +
      '<button class="sf-rec-x" onclick="SF.closeRecord()" aria-label="' + esc(T("common.closeEsc")) + '" title="' + esc(T("common.closeEsc")) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      "</header>";
  }

  /* Tiêu đề dự án — inline edit, nằm đầu cột trái */
  function titleHTML(r) {
    var editable = capEdit(r, me) && r.status === "IN PROGRESS";
    var titleText = (r.title && r.title.trim()) ? r.title : (r.customer + " · " + r.product);
    return '<div class="sf-rec-title-row"' + (editable ? ' onclick="SF.startEditTitle()" title="' + esc(T("sf.renameHint")) + '"' : "") + ">" +
      '<h3 id="sfRecTitle">' + esc(titleText) + "</h3>" +
      (editable ? '<span class="sf-title-edit" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></span>' : "") +
      "</div>";
  }

  /* Khối TIẾN ĐỘ & PHỤ TRÁCH — người phụ trách · ngày tạo · ngày đóng dự kiến */
  function daysTo(iso) {
    var d = parseWhen(iso); if (!d) return null;
    return Math.round((d - new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate())) / 864e5);
  }
  function progressHTML(r, editable) {
    var n = daysTo(r.closing);
    var hint = n == null ? "" : n < 0 ? '<span class="hint late">' + T("sf.daysLate", { n: Math.abs(n) }) + "</span>"
      : n === 0 ? '<span class="hint late">' + T("sf.dueToday") + "</span>" : '<span class="hint">' + T("sf.daysLeft", { n: n }) + "</span>";
    return '<h4 class="sf-sec-h">' + T("sf.sec.progressOwner") + '</h4>' +
      '<dl class="sf-prog">' +
        '<div><dt>' + T("common.ownerFull") + '</dt><dd><span class="sf-av" style="background:' + colorOf(r.pic) + '">' + initials(r.pic || "?") + "</span>" + esc(r.pic || "—") + "</dd></div>" +
        "<div><dt>" + T("common.createdDate") + "</dt><dd class=\"num\">" + viDate(r.created) + "</dd></div>" +
        '<div><dt>' + T("common.expectedClose") + '</dt><dd>' +
          (editable
            /* Ô ngày: hiển thị luôn DD/MM/YYYY (không phụ thuộc locale trình duyệt),
               input date gốc phủ trong suốt để vẫn dùng lịch native + giữ value ISO. */
            ? '<span class="sf-dfield" data-f="closing">' +
                '<span class="sf-dtext num" id="sfClosingTxt">' + (r.closing ? viDate(r.closing) : T("common.pickDate")) + "</span>" +
                '<svg class="sf-dcal" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>' +
                '<input type="date" class="sf-dinput" id="sfClosing" value="' + (r.closing || "") + '"' +
                  ' aria-label="' + esc(T("common.expectedClose")) + '"' +
                  ' onclick="try{this.showPicker()}catch(e){}" oninput="SF.syncClosing()">' +
              "</span>"
            : '<span class="num">' + viDate(r.closing) + "</span>") +
          (r.status === "IN PROGRESS" ? hint : "") +
        "</dd></div>" +
      "</dl>";
  }

  /* Quick composer — ghi nhanh ngay đầu nhật ký, không giấu sau modal phụ */
  /* Icon theo ngữ cảnh loại hoạt động */
  var QL_IC = {
    Call: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2.1z"/>',
    Visit: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    Email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    Note: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
  };
  function qlIcon(t) {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (QL_IC[t] || QL_IC.Note) + "</svg>";
  }
  function composerHTML(r) {
    if (!capEdit(r, me)) return "";
    return '<div class="sf-quicklog" id="sfQl">' +
        '<div class="sf-ql-head">' +
          '<span class="sf-ql-ic" id="sfQlIc">' + qlIcon("Call") + "</span>" +
          '<select id="sfQlType" class="sf-ql-type" aria-label="' + esc(T("act.type")) + '" onchange="SF.qlType(this.value)">' +
            '<option value="Call">' + T("act.t.call") + '</option><option value="Visit">' + T("act.t.meeting") + '</option>' +
            '<option value="Email">Email</option><option value="Note">' + T("act.t.note") + '</option></select>' +
          '<span class="sf-ql-hint">' + T("sf.ql.hint") + '</span>' +
          '<button type="button" class="sf-ql-btn" onclick="SF.quickLog()">' + T("sf.ql.log") + '</button>' +
        "</div>" +
        '<textarea id="sfQlNote" class="sf-ql-note" rows="1" autocomplete="off"' +
          ' placeholder="' + esc(T("sf.ql.ph")) + '"' +
          ' oninput="SF.qlGrow(this)"' +
          ' onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();SF.quickLog()}"></textarea>' +
      "</div>";
  }
  function qlType(t) {
    var ic = document.getElementById("sfQlIc");
    if (ic) ic.innerHTML = qlIcon(t);
    var box = document.getElementById("sfQl");
    if (box) box.setAttribute("data-type", t);
  }
  function qlGrow(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 168) + "px";
  }
  /* Cập nhật nhãn DD/MM/YYYY khi chọn ngày đóng dự kiến (ô date bị che) */
  function syncClosing() {
    var i = document.getElementById("sfClosing"), t = document.getElementById("sfClosingTxt");
    if (i && t) t.textContent = i.value ? viDate(i.value) : T("common.pickDate");
  }

  /* Chevron path liền mạch (kiểu Salesforce Path) — click để đổi giai đoạn trực tiếp */
  /* Chevron path — CHỈ các bước quy trình của pipeline. Kết quả cuối (Thắng/Thua/
     Tạm hoãn) là vòng đời của dự án, quản lý ở dropdown trạng thái trên header. */
  function stageLbl(k) { return k === "WON" ? T("status.won") : k === "LOST" ? T("status.lost") : stageShort(k); }
  function pathHTML(r, editable) {
    var pipe = pipelineOf(r.ncc, r.status === "IN PROGRESS" ? r.stage : null)
      .filter(function (x) { return x !== "WON" && x !== "LOST"; });
    var cur = pipe.indexOf(r.stage);
    var closed = r.status !== "IN PROGRESS";
    var tone = r.status === "WON" ? " is-won" : r.status === "LOST" ? " is-lost" : (r.onHold ? " is-hold" : "");

    var steps = pipe.map(function (s, i) {
      var cls = "sf-step";
      if (closed) cls += r.status === "WON" ? " done" : " muted";
      else if (i < cur) cls += " done";
      else if (i === cur) cls += " current";
      var on = editable && !closed;
      if (!on) cls += " locked";
      return '<button type="button" class="' + cls + '"' +
        (on ? ' onclick="SF.moveStage(' + jsq(r.id) + "," + jsq(s) + ')"' : " disabled") +
        ' title="' + esc(s) + '"><span class="st-t">' + esc(stageLbl(s)) + "</span></button>";
    });
    return '<div class="sf-path' + tone + '" role="group" aria-label="' + esc(T("sf.path")) + '">' +
      steps.join("") + "</div>" + outcomeBanner(r);
  }

  /* Banner kết quả — chỉ hiện khi dự án không còn chạy bình thường */
  function outcomeBanner(r) {
    var ic = function (d) {
      return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
    };
    if (r.status === "LOST") {
      return '<div class="sf-outcome lost">' + ic('<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>') +
        "<b>" + T("sf.out.lostT") + "</b><span>" + T("sf.out.lostD") + "</span></div>";
    }
    if (r.status === "WON") {
      return '<div class="sf-outcome won">' + ic('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>') +
        "<b>" + T("sf.out.wonT") + "</b><span>" + T("sf.out.wonD") + "</span></div>";
    }
    if (r.onHold) {
      return '<div class="sf-outcome hold">' + ic('<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>') +
        "<b>" + T("sf.out.holdT") + "</b><span>" + T("sf.out.holdD") + "</span></div>";
    }
    return "";
  }

  // "dd/mm/yyyy [HH:MM]" hoặc "yyyy-mm-dd" → Date (để sắp xếp timeline)
  function parseWhen(s) {
    if (!s) return null;
    s = String(s).trim();
    var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
    var vn = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (vn) return new Date(+vn[3], +vn[2] - 1, +vn[1], +(vn[4] || 0), +(vn[5] || 0));
    return null;
  }

  /* Nhật ký hoạt động — hoạt động khách hàng + ghi chú, mới nhất lên đầu.
     Không còn mốc “Tạo dự án” / “Mục tiêu chốt” (đã có ở khối Tiến độ). */
  /* Hình thức tương tác giữ nguyên tiếng Anh ở cả 2 ngôn ngữ (đồng bộ với tracker) */
  var TYPE_VI = { Call: "Call", Visit: "Visit", Meeting: "Visit", Email: "Email", Exhibition: "Trade Show", Seminar: "Trade Show", "Trade Show": "Trade Show" };
  function timelineHTML(r) {
    var ev = [];
    (typeof ACTIVITIES !== "undefined" ? ACTIVITIES : []).filter(function (a) { return a.projectId === r.id; })
      .forEach(function (a) {
        ev.push({ d: parseWhen(a.date), tag: TYPE_VI[a.type] || a.type || T("common.activity"), who: a.pic,
          text: a.note || "", next: a.next || "", kind: "act" });
      });
    (r.comments || []).forEach(function (c) {
      ev.push({ d: parseWhen(c.at), tag: "Note", who: c.by, text: c.text || "", kind: "note" });
    });
    ev.sort(function (a, b) { return (b.d ? b.d.getTime() : 0) - (a.d ? a.d.getTime() : 0); });

    var extSvg = '<svg class="sf-tl-ext" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h6"/></svg>';
    var body = ev.length ? ev.map(function (e) {
      var when = dmy(e.d);
      var isAct = e.kind === "act";
      var attrs = isAct ? ' role="link" tabindex="0" title="' + esc(T("sf.openActHint")) + '"' +
        ' onclick="SF.openActivityLink(' + jsq(r.customer) + ')"' +
        ' onkeydown="if(event.key===\'Enter\'){SF.openActivityLink(' + jsq(r.customer) + ')}"' : "";
      return '<li class="sf-tl-item ' + e.kind + (isAct ? " link" : "") + '"' + attrs + '><span class="sf-tl-dot"></span>' +
        '<div class="sf-tl-c"><div class="sf-tl-top"><span class="sf-tl-tag">' + esc(e.tag) + (isAct ? extSvg : "") +
        '</span><span class="sf-tl-when num">' + esc(when) + "</span></div>" +
        '<p class="sf-tl-text">' + esc(e.text) + (e.who ? ' <span class="sf-tl-who">· ' + esc(e.who) + "</span>" : "") + "</p>" +
        (e.next ? '<p class="sf-tl-next"><b>' + T("act.nextStep") + '</b>' + esc(e.next) + "</p>" : "") +
        "</div></li>";
    }).join("") : '<li class="sf-act-empty">' + T("sf.tl.empty") + '</li>';

    return '<h4 class="sf-sec-h">' + T("sf.sec.timeline") + '</h4><ol class="sf-timeline">' + body + "</ol>";
  }

  /* Ghi nhanh hoạt động/ghi chú ngay đầu nhật ký — không cần mở modal phụ */
  function quickLog() {
    var r = recById(curId); if (!r) return;
    if (!capEdit(r, me)) { toast(T('sf.msg.noActPerm')); return; }
    var note = (val("sfQlNote") || "").trim();
    if (!note) { var i = document.getElementById("sfQlNote"); if (i) i.focus(); return; }
    var type = val("sfQlType") || "Call";

    if (type === "Note") {
      r.comments = r.comments || [];
      r.comments.push({ by: me.pic || me.name, at: nowStamp(), text: note });
      buildRecord();
      toast(T('sf.msg.noteSavedLocal'));
      return;
    }
    var a = {
      customer: r.customer, pic: me.pic || me.name, ncc: r.ncc || "", nccs: r.ncc ? [r.ncc] : [],
      product: r.product, type: type, date: todayISO(), note: note, next: "", potential: "Medium",
      related: [], projectId: r.id, id: "A-tmp" + Date.now(), spId: null
    };
    ACTIVITIES.push(a);
    buildRecord();
    var live = window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite() && r.spId;
    toast(live ? T("sf.msg.actSyncing") : T("sf.msg.actLocal"));
    if (live) {
      FISG_STORE.createActivity(a).then(function (spId) {
        a.spId = spId; a.id = "A-" + spId; buildRecord();
      }).catch(function (e) { toast(T("sf.msg.syncFailed") + " " + (e.message || e)); });
    }
  }

  /* Copy mã dự án bằng một click */
  function copyId(id, btn) {
    var done = function () {
      if (!btn) return;
      btn.classList.add("copied");
      setTimeout(function () { btn.classList.remove("copied"); }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).then(function () { done(); toast(T("sf.msg.copied", { id: id })); })
        .catch(function () { toast(T("sf.msg.copyFailed", { id: id })); });
    } else {
      var t = document.createElement("textarea"); t.value = id; document.body.appendChild(t);
      t.select(); try { document.execCommand("copy"); done(); toast(T("sf.msg.copied", { id: id })); }
      catch (e) { toast(T("sf.msg.copyFailed", { id: id })); }
      document.body.removeChild(t);
    }
  }

  /* Inline edit tên dự án (tuỳ chỉnh) — thay tiêu đề bằng ô nhập ngay tại chỗ */
  function startEditTitle() {
    var r = recById(curId); if (!r) return;
    if (!capEdit(r, me) || r.status !== "IN PROGRESS") return;
    if (document.getElementById("sfTitleInput")) return;
    var h = document.getElementById("sfRecTitle"); if (!h) return;
    var row = h.parentElement;
    row.removeAttribute("onclick"); row.removeAttribute("title"); row.classList.add("editing");
    var cur = (r.title && r.title.trim()) ? r.title : (r.customer + " · " + r.product);
    row.innerHTML = '<input id="sfTitleInput" class="sf-title-input" value="' + esc(cur) + '"' +
      ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();SF.saveTitle()}if(event.key===\'Escape\'){event.stopPropagation();SF.cancelEditTitle()}"' +
      ' onblur="SF.saveTitle()">';
    var inp = document.getElementById("sfTitleInput");
    inp.focus(); inp.select();
  }
  function saveTitle() {
    var r = recById(curId); if (!r) return;
    var inp = document.getElementById("sfTitleInput"); if (!inp) return;
    var v = (inp.value || "").trim();
    var fallback = r.customer + " · " + r.product;
    r.title = (v && v !== fallback) ? v : "";
    buildRecord();
    toast(r.title ? T("sf.msg.renamed") : T("sf.msg.defaultName"));
  }
  function cancelEditTitle() { buildRecord(); }

  /* mở hoạt động của khách hàng trên tracker chính (index.html = tracker.fisaigon.vn) */
  function openActivityLink(customer) {
    var url = "index.html?open=acts&q=" + encodeURIComponent(customer || "");
    window.open(url, "_blank");
  }

  /* ---------- Cột phải: 3 khối card ---------- */
  function mrow(label, valueHTML, cls) {
    return '<div class="sf-mrow' + (cls ? " " + cls : "") + '"><dt>' + label + "</dt><dd>" + valueHTML + "</dd></div>";
  }
  function mval(v) { return '<span class="mv">' + (v == null || v === "" ? "—" : v) + "</span>"; }

  /* Badge xác suất đổi màu theo giá trị — không để 90% vẫn hiện màu cảnh báo */
  function probTone(p) { return p >= 70 ? "high" : p >= 30 ? "mid" : "low"; }
  /* 3.250.000.000 → "3,25 tỷ ₫" — số đầy đủ nằm ở tooltip */
  function shortMoney(n) {
    n = Number(n) || 0;
    var dec = function (x) { return I18N.lang() === "en" ? String(x) : String(x).replace(".", ","); };
    if (n >= 1e9) return T("num.billionVnd", { v: dec(+(n / 1e9).toFixed(2)) });
    if (n >= 1e6) return T("num.millionVnd", { v: dec(+(n / 1e6).toFixed(1)) });
    return groupNum(n) + " ₫";
  }
  function fullMoney(n) { return groupNum(n) + " ₫"; }
  function repaintProb(sel) {
    sel.classList.remove("low", "mid", "high");
    sel.classList.add(probTone(+sel.value || 0));
  }

  /* Khối 1 — chỉ số thương mại & sản lượng (hero metric) */
  function cardMetricsHTML(r, editable) {
    var total = (r.kgThis || 0) + (r.kgNext || 0);
    var amt = (r.amount != null && r.amount !== "") ? Number(r.amount) : null;
    var unit = (amt != null && total > 0) ? Math.round(amt / total) : null;
    // luôn chèn xác suất hiện tại vào danh sách — STAGE_PROB có các mốc 40/60/80
    // không nằm trong preset, nếu thiếu thì select sẽ tự nhảy về 10% và hiển thị sai.
    var cur = probPct(r);
    var probList = [10, 25, 50, 75, 90, 100];
    if (probList.indexOf(cur) < 0) { probList.push(cur); probList.sort(function (a, b) { return a - b; }); }
    var probOpts = probList.map(function (p) {
      return '<option value="' + p + '"' + (p === cur ? " selected" : "") + ">" + p + "%</option>";
    }).join("");

    return '<section class="sf-card"><h4 class="sf-card-h">' + T("sf.card.estValue") + '</h4>' +
      '<div class="sf-hero">' +
        '<div class="sf-hero-v">' +
          (editable
            ? '<input class="sf-hero-in num" type="text" inputmode="numeric" id="sfAmount" placeholder="0"' +
              ' value="' + (amt != null ? shortMoney(amt) : "") + '"' +
              (amt != null ? ' title="' + fullMoney(amt) + '"' : "") +
              ' onfocus="SF.amountFocus(this)" oninput="SF.fmtAmountInput(this)"' +
              ' onchange="SF.saveAmount()" onblur="SF.amountBlur(this)">'
            : '<p class="num"' + (amt != null ? ' title="' + fullMoney(amt) + '"' : "") + ">" +
              (amt != null ? shortMoney(amt) : "—") + "</p>") +
          '<p class="sf-hero-l">' + (amt != null ? fullMoney(amt) : T("sf.noValue")) + "</p>" +
        "</div>" +
        '<div class="sf-prob-wrap">' +
          '<span class="sf-prob-l">' + T("sf.probability") + '</span>' +
          (editable
            ? '<select class="sf-prob-badge num ' + probTone(probPct(r)) + '" id="sfProb" aria-label="' + esc(T("sf.winProb")) + '"' +
              ' onchange="SF.repaintProb(this)">' + probOpts + "</select>"
            : '<span class="sf-prob-badge num ' + probTone(probPct(r)) + '">' + probPct(r) + "%</span>") +
        "</div>" +
      "</div>" +
      '<dl class="sf-meta">' +
        mrow(T("sf.potentialYear", { y: TODAY.getFullYear() }), mval('<span class="num">' + fmt(r.kgThis) + "</span> <small>KG</small>")) +
        mrow(T("sf.potentialYear", { y: TODAY.getFullYear() + 1 }), mval('<span class="num">' + fmt(r.kgNext) + "</span> <small>KG</small>")) +
        mrow(T("sf.unitPrice"), mval(unit != null ? '<span class="num">' + groupNum(unit) + "</span> <small>" + T("sf.perKg") + "</small>" : "")) +
      "</dl></section>";
  }

  /* Khối 2 — đối tác & phân khúc */
  function cardPartnerHTML(r, editable) {
    return '<section class="sf-card"><h4 class="sf-card-h">' + T("sf.card.partner") + '</h4><dl class="sf-meta">' +
      mrow(T("common.account"), mval(esc(r.customer))) +
      mrow(T("common.product"), mval(esc(r.product))) +
      mrow(T("common.application"), mval(esc(r.application))) +
      mrow(T("common.supplier"), mval(esc(r.ncc))) +
      (editable
        ? mrow("Segment", '<select class="mi-in" id="sfSegment" onchange="SF.onSegmentChange()">' + segmentOptions(r.segment) + "</select>") +
          mrow(T("common.industry"), '<span class="mv" id="sfGroupDerived">' + esc(r.group || "—") + "</span>" +
            '<span class="mv-hint">' + T("sf.autoBySegment") + '</span>')
        : mrow(T("sf.industrySegment"), mval(esc(r.group) + ' <span class="sep">/</span> ' + esc(r.segment)))) +
      "</dl></section>";
  }

  /* Khối 3 — nội bộ & rủi ro */
  function cardInternalHTML(r, editable) {
    var people = (r.related || []).filter(Boolean);
    var risk = (r.risk || "").trim();
    return '<section class="sf-card"><h4 class="sf-card-h">' + T("sf.card.other") + '</h4><dl class="sf-meta">' +
      mrow(T("sf.oppType"), mval(esc(r.boptype))) +
      mrow(T("common.participants"), people.length
        ? '<span class="mv who">' + people.map(function (x) {
            return '<span class="sf-av" style="background:' + colorOf(x) + '" title="' + esc(x) + '">' + initials(x) + "</span>";
          }).join("") + esc(people.join(", ")) + "</span>"
        : mval("")) +
      '<div class="sf-mrow risk"><dt>' + T("sf.risk") + '</dt><dd>' +
        (risk ? '<p class="sf-risk-text">' + esc(risk) + "</p>" : '<p class="sf-side-empty">' + T("sf.noRisk") + '</p>') +
        (editable ? '<div class="sf-risk-edit"><input id="sfRisk" placeholder="' + esc(T("sf.riskPh")) + '" value="' + esc(risk) + '">' +
          '<button class="sf-mini-btn" onclick="SF.saveRisk()">' + T("common.save") + '</button></div>' : "") +
      "</dd></div>" +
      "</dl></section>";
  }

  // Danh mục Segment nhóm theo Nhóm ngành (BAKERY / SAVOURY / SWEET …) — chuẩn từ catalog
  function segmentOptions(cur) {
    var groups = (typeof SEG_GROUPS !== "undefined" && SEG_GROUPS.length) ? SEG_GROUPS : Object.keys(SEG_TREE || {});
    var found = false;
    var html = groups.map(function (g) {
      var segs = (SEG_TREE && SEG_TREE[g]) || [];
      return '<optgroup label="' + esc(g) + '">' + segs.map(function (s) {
        var sel = s === cur; if (sel) found = true;
        return '<option value="' + esc(s) + '"' + (sel ? " selected" : "") + ">" + esc(s) + "</option>";
      }).join("") + "</optgroup>";
    }).join("");
    if (cur && !found) html = '<option value="' + esc(cur) + '" selected>' + esc(cur) + " (" + T("common.otherLower") + ")</option>" + html;
    return html;
  }
  // chọn Segment → tự suy ra Nhóm ngành (segment group) để hiển thị
  function onSegmentChange() {
    var seg = val("sfSegment");
    var g = (typeof SEG2GROUP !== "undefined" && SEG2GROUP[seg]) || "—";
    var el = document.getElementById("sfGroupDerived");
    if (el) el.textContent = g;
  }

  // định dạng ô nhập với dấu phẩy khi gõ
  /* Ô tiền: đang gõ thì hiện số đầy đủ, rời khỏi ô thì thu về dạng rút gọn */
  function amountFocus(el) {
    var r = recById(curId); if (!r) return;
    el.value = (r.amount != null && r.amount !== "") ? groupNum(r.amount) : "";
    try { el.select(); } catch (e) {}
  }
  function amountBlur(el) {
    var r = recById(curId); if (!r || !el || !el.isConnected) return;
    if (r.amount == null || r.amount === "") { el.value = ""; el.removeAttribute("title"); return; }
    el.value = shortMoney(r.amount);
    el.title = fullMoney(r.amount);
  }
  function fmtAmountInput(el) {
    var digits = (el.value || "").replace(/[^0-9]/g, "");
    el.value = digits ? Number(digits).toLocaleString(I18N.locale()) : "";
  }

  /* Cột phải = 3 khối card, không phải 1 list phẳng trải dài */
  function sideHTML(r, editable) {
    return cardMetricsHTML(r, editable) + cardPartnerHTML(r, editable) + cardInternalHTML(r, editable);
  }

  function footHTML(r, editable) {
    /* Nút "Đóng dự án" đỏ đã chuyển lên dropdown trạng thái ở header */
    return '<div class="sf-rec-foot">' +
      "<span style='margin-right:auto'></span>" +
      (editable ? '<span class="sf-kbd-hint"><kbd>Esc</kbd> ' + T("common.closeLower") + ' · <kbd>' + (isMac() ? "⌘" : "Ctrl") + "</kbd>+<kbd>S</kbd> " + T("common.saveLower") + "</span>"
                : '<span class="sf-kbd-hint"><kbd>Esc</kbd> ' + T("common.closeLower") + '</span>') +
      '<button class="sf-btn ghost" onclick="SF.closeRecord()">' + T("common.close") + '</button>' +
      (editable ? '<button class="sf-btn primary" onclick="SF.saveRecord()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>' + T("common.saveChanges") + '</button>' : "") +
      "</div>";
  }

  function saveRecord() {
    var r = recById(curId); if (!r) return;
    if (!capEdit(r, me)) { toast(T('sf.msg.noEditPerm')); return; }
    var patch = {}, changes = [];
    var stage = val("sfStage"), prob = val("sfProb"), closing = val("sfClosing");
    if (stage && stage !== r.stage) { changes.push("[Giai đoạn] " + stageShort(r.stage) + " → " + stageShort(stage)); r.stage = stage; patch.Stage = stage; }
    if (prob != null && +prob !== probPct(r)) { changes.push("[Xác suất] " + probPct(r) + "% → " + prob + "%"); r.prob = +prob / 100; patch.WinProbability = +prob; }
    else if (patch.Stage && STAGE_PROB && STAGE_PROB[stage] != null) { r.prob = STAGE_PROB[stage] / 100; patch.WinProbability = probPct(r); }
    if (closing && closing !== r.closing) { changes.push("[Ngày đóng] " + viDate(r.closing) + " → " + viDate(closing)); r.closing = closing; patch.ClosingDate = closing + "T12:00:00Z"; }
    var seg = val("sfSegment");
    if (seg && seg !== r.segment) {
      var g = (typeof SEG2GROUP !== "undefined" && SEG2GROUP[seg]) || r.group;
      changes.push("[Segment] " + (r.segment || "—") + " → " + seg + " · Nhóm ngành: " + g);
      r.segment = seg; r.group = g; patch.Segment = seg; patch.SegmentGroup = g;
    }
    if (!Object.keys(patch).length) { toast(T('common.msg.noChanges')); return; }
    buildRecord(); render();
    persist(r, patch, changes.join(" · "), T("sf.msg.saved", { name: r.customer + " · " + r.product }), null);
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value : null; }

  function saveRisk() {
    var r = recById(curId); if (!r) return;
    if (!capEdit(r, me)) { toast(T('sf.msg.noRiskPerm')); return; }
    var v = (val("sfRisk") || "").trim();
    r.risk = v;
    buildRecord();
    toast(v ? T("sf.msg.riskSaved") : T("sf.msg.riskCleared"));
  }

  function saveAmount() {
    var r = recById(curId); if (!r) return;
    if (!capEdit(r, me)) { toast(T('sf.msg.noValuePerm')); return; }
    var v = (val("sfAmount") || "").replace(/[^0-9]/g, "");
    r.amount = v === "" ? "" : Math.max(0, parseInt(v, 10) || 0);
    buildRecord(); render();
    toast(r.amount === "" ? T("sf.msg.valueCleared") : T("sf.msg.valueSaved"));
  }

  /* ---------- close won/lost ---------- */
  function openClose(pre) {
    var r = recById(curId); if (!r || !capClose(r, me)) { toast(T('sf.msg.closeOnlyOwner')); return; }
    closePick = (pre === "WON" || pre === "LOST") ? pre : null;
    var bd = document.getElementById("sfCloseBd");
    if (!bd) { bd = buildCloseModal(); }
    document.getElementById("sfCloseSub").textContent = r.customer + " · " + r.product;
    document.getElementById("sfCloseReason").value = "";
    document.querySelectorAll("#sfCloseBd .sf-cm-opt").forEach(function (o) {
      o.classList.toggle("sel", !!closePick && o.classList.contains(closePick === "WON" ? "won" : "lost"));
    });
    bd.classList.add("open");
  }
  function buildCloseModal() {
    var bd = document.createElement("div");
    bd.className = "sf-cm-bd"; bd.id = "sfCloseBd";
    bd.innerHTML =
      '<div class="sf-cm"><div class="sf-cm-h">' + T("sf.closeOpp") + ' <span id="sfCloseSub" style="font-weight:400;color:var(--ink-3);font-size:13px"></span></div>' +
      '<div class="sf-cm-b"><div class="sf-cm-opts">' +
        '<div class="sf-cm-opt won" onclick="SF.pickClose(\'WON\',this)"><b style="color:var(--won)">' + T("status.won") + '</b><small>' + T("sf.close.wonHint") + '</small></div>' +
        '<div class="sf-cm-opt lost" onclick="SF.pickClose(\'LOST\',this)"><b style="color:var(--lost)">' + T("status.lost") + '</b><small>' + T("sf.close.lostHint") + '</small></div>' +
      "</div>" +
      '<textarea id="sfCloseReason" placeholder="' + esc(T("sf.close.reasonPh")) + '"></textarea></div>' +
      '<div class="sf-cm-f"><button class="sf-btn ghost" onclick="SF.cancelClose()">' + T("common.cancel") + '</button>' +
      '<button class="sf-btn primary" onclick="SF.confirmClose()">' + T("sf.close.confirm") + '</button></div></div>';
    bd.addEventListener("click", function (e) { if (e.target === bd) cancelClose(); });
    document.body.appendChild(bd);
    return bd;
  }
  function pickClose(res, el) {
    closePick = res;
    document.querySelectorAll("#sfCloseBd .sf-cm-opt").forEach(function (o) { o.classList.remove("sel"); });
    el.classList.add("sel");
  }
  function cancelClose() { var bd = document.getElementById("sfCloseBd"); if (bd) bd.classList.remove("open"); }
  function confirmClose() {
    var r = recById(curId); if (!r) return;
    var reason = (document.getElementById("sfCloseReason").value || "").trim();
    if (!closePick) { toast(T('sf.msg.pickOutcome')); return; }
    if (!reason) { toast(T('sf.msg.enterReason')); return; }
    var res = closePick, label = res === "WON" ? "Thắng" : "Thua";   // audit log text stays VI (shared SharePoint record)
    var uiLabel = res === "WON" ? T("status.won") : T("status.lost");
    r.status = res; r.prob = res === "WON" ? 1 : 0; r.closedAt = todayISO(); r.onHold = false;
    r.comments = r.comments || [];
    r.comments.push({ by: me.pic || me.name, at: nowStamp(), text: "[Đóng dự án — " + label + "] " + reason });
    cancelClose(); buildRecord(); render();
    persist(r, { Status: "Closed", Result: res, WinProbability: res === "WON" ? 100 : 0 },
      "[Đóng dự án — " + label + "] " + reason,
      T("sf.msg.closed", { name: r.customer + " · " + r.product, outcome: uiLabel }), null);
  }

  /* ---------- Phím tắt: Esc = đóng · Cmd/Ctrl+S = lưu ---------- */
  function anyModalOpen() {
    return ["sfCloseBd"].some(function (id) {
      var el = document.getElementById(id); return el && el.classList.contains("open");
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var cb = document.getElementById("sfCloseBd");
      if (cb && cb.classList.contains("open")) { cancelClose(); return; }
      if (document.getElementById("sfTitleInput")) { cancelEditTitle(); return; }
      if (curId) closeRecord();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
      if (!curId || anyModalOpen()) return;
      e.preventDefault();
      var r = recById(curId);
      if (r && capEdit(r, me) && r.status === "IN PROGRESS") saveRecord();
      else toast(T('sf.msg.readOnly'));
    }
  });

  /* ---------- i18n: re-render everything in place on EN | VI switch ---------- */
  if (window.I18N) I18N.onChange(function () {
    if (!me) return;
    try { renderUser(); renderNccTabs(); render(); if (curId) buildRecord(); } catch (e) { console.error(e); }
  });

  /* ---------- expose ---------- */
  window.SF = {
    render: render, setNcc: setNcc, setStatus: setStatus,
    openRecord: openRecord, closeRecord: closeRecord, toggleCustomer: toggleCustomer, toggleAll: toggleAll,
    moveStage: moveStage, saveRecord: saveRecord, saveRisk: saveRisk, saveAmount: saveAmount, onSegmentChange: onSegmentChange,
    copyId: copyId, quickLog: quickLog, repaintProb: repaintProb,
    startEditTitle: startEditTitle, saveTitle: saveTitle, cancelEditTitle: cancelEditTitle,
    openActivityLink: openActivityLink, fmtAmountInput: fmtAmountInput,
    openClose: openClose, pickClose: pickClose, cancelClose: cancelClose, confirmClose: confirmClose,
    amountFocus: amountFocus, amountBlur: amountBlur, qlType: qlType, qlGrow: qlGrow,
    stMenu: stMenu, setLifecycle: setLifecycle, syncClosing: syncClosing
  };
})();
