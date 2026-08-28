/* ============================================================
   Sales Funnel — Salesforce-style workspace (Phase 1)
   Trang riêng salesfunnel.html. Tái dùng tầng data của app chính
   (catalog/config/insights/roles/store/auth) và tự render workspace
   Kanban + Record Page. KHÔNG đụng DOM của index.html.
   ============================================================ */
(function () {
  "use strict";

  var statusFilter = "IN PROGRESS";   // IN PROGRESS | WON | LOST
  var viewMode = "board";             // board | list
  var curId = null;                   // record đang mở
  var recTab = "overview";
  var closePick = null;
  var expanded = {};                  // KH nào đang bung project (cây thư mục)

  var PALETTE = ["#01426A", "#0A5C8F", "#0E7490", "#6D28D9", "#B45309", "#157F3C"];

  /* ---------- toast (trang riêng, không phụ thuộc modal của index) ---------- */
  var _toastT;
  function toast(m) {
    var t = document.getElementById("toastEl"); if (!t) { return; }
    t.textContent = m; t.style.display = "block";
    clearTimeout(_toastT); _toastT = setTimeout(function () { t.style.display = "none"; }, 4600);
  }
  window.toast = toast;

  /* ---------- helpers ---------- */
  function fmt(n) { return (n || 0).toLocaleString("vi-VN"); }
  function initials(n) { return String(n || "?").trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase(); }
  function colorOf(pic) { var u = USERS.find(function (x) { return x.pic === pic; }); return u ? u.color : "#4A5F70"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function viDate(d) { return d ? new Date(d).toLocaleDateString("vi-VN") : "—"; }
  function probPct(r) { return Math.round((r.prob || 0) * 100); }
  function stageShort(s) {
    return String(s || "").replace("SHARED BUSINESS GOAL", "SHARED GOAL").replace("BUILDING A SOLUTION", "BUILDING")
      .replace("SOLUTION TESTING", "TESTING").replace("OFFER & AGREEMENT", "OFFER").replace("QUOTED / PO", "QUOTED/PO")
      .replace("TEST PASSED", "PASSED");
  }
  function nowStamp() {
    var d = new Date();
    return d.toLocaleDateString("vi-VN") + " " + d.toTimeString().slice(0, 5);
  }
  function recById(id) { return RECORDS.find(function (r) { return r.id === id; }); }

  function inScope(r) { return !nccFilter || isAllNcc() || r.ncc === nccFilter; }
  function scoped() { return scopeRecords(RECORDS.filter(inScope), me); }
  function searchQ() { return (document.getElementById("sfQ").value || "").toLowerCase().trim(); }
  function matchQ(r, q) { return !q || (r.customer + " " + r.product + " " + r.application + " " + (r.pic || "")).toLowerCase().indexOf(q) >= 0; }

  function health(r) {
    if (r.status === "WON") return { cls: "green", label: "Đã thắng" };
    if (r.status === "LOST") return { cls: "red", label: "Đã thua" };
    if (r.closing && new Date(r.closing) < TODAY) return { cls: "red", label: "Trễ hạn" };
    if ((r.prob || 0) >= 0.6) return { cls: "green", label: "On track" };
    if ((r.prob || 0) >= 0.3) return { cls: "amber", label: "Cần đẩy" };
    return { cls: "amber", label: "Mới" };
  }

  /* ============================================================
     BOOT — loginAs override (auth.js gọi khi đã xác thực)
     ============================================================ */
  function loginAs(i) {
    me = USERS[i];
    if (!me) return;
    nccFilter = ALL_NCC;   // mặc định xem Tất cả nhà cung cấp
    document.getElementById("sfLogin").style.display = "none";
    document.getElementById("sfApp").style.display = "flex";
    renderUser();
    renderNccTabs();
    render();
  }
  window.loginAs = loginAs;

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

  function renderNccTabs() {
    var box = document.getElementById("sfNcc");
    var html = '<button class="sf-ncc-tab' + (isAllNcc() ? " on" : "") + '" data-ncc="' + ALL_NCC +
      '" onclick="SF.setNcc(\'' + ALL_NCC + '\')" title="Tất cả nhà cung cấp — chỉ xem theo nhóm giai đoạn">' + ALL_NCC_LABEL + "</button>";
    html += NCCS.map(function (n) {
      return '<button class="sf-ncc-tab' + (n === nccFilter ? " on" : "") + '" data-ncc="' + esc(n) +
        '" onclick="SF.setNcc(\'' + n.replace(/'/g, "\\'") + '\')">' + esc(n) + "</button>";
    }).join("");
    box.innerHTML = html;
  }

  function setNcc(n) { nccFilter = n; if (isAllNcc() && viewMode === "board") { /* group columns, read-only */ } renderNccTabs(); render(); }
  function setStatus(st) {
    statusFilter = st;
    document.querySelectorAll("#sfStatusSeg .sf-seg-b").forEach(function (b) { b.classList.toggle("on", b.dataset.st === st); });
    // WON/LOST không còn giai đoạn pipeline sống → luôn hiện danh sách; render() tự xử lý.
    render();
  }
  function setView(v) {
    viewMode = v;
    document.querySelectorAll("#sfViewToggle .sf-vt-b").forEach(function (b) { b.classList.toggle("on", b.dataset.view === v); });
    render();
  }

  /* ============================================================
     RENDER workspace
     ============================================================ */
  function render() {
    if (!me) return;
    var q = searchQ();
    var rows = scoped().filter(function (r) { return r.status === statusFilter; }).filter(function (r) { return matchQ(r, q); });
    renderStats(scopeRecords(RECORDS, me));   // KPI = tổng toàn bộ dự án trong quyền xem (mọi NCC)

    var list = document.getElementById("sfList"), empty = document.getElementById("sfEmpty");
    if (!rows.length) {
      list.hidden = true; empty.hidden = false;
      empty.innerHTML =
        '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/></svg>' +
        "<b>Không có dự án nào</b><span>Thử đổi nhà cung cấp, bộ lọc trạng thái, hoặc từ khoá tìm kiếm.</span>";
      return;
    }
    empty.hidden = true; list.hidden = false;
    renderList(rows);
  }

  // KPI = số lượng dự án theo trạng thái (không còn KG), phủ đều trang
  function renderStats(all) {
    var run = all.filter(function (r) { return r.status === "IN PROGRESS"; }).length;
    var won = all.filter(function (r) { return r.status === "WON"; }).length;
    var lost = all.filter(function (r) { return r.status === "LOST"; }).length;
    function node(n, l, cls) { return '<div class="sf-stat ' + cls + '"><b>' + n + '</b><small>' + l + '</small></div>'; }
    document.getElementById("sfStats").innerHTML =
      node(run, "Đang chạy", "run") + node(won, "Thắng", "won") + node(lost, "Thua", "lost");
  }

  function renderBoard(rows) {
    var stages = activeStages();
    var canDrag = !isAllNcc();
    var box = document.getElementById("sfBoard");
    box.innerHTML = stages.map(function (s, i) {
      var cards = rows.filter(function (r) { return atStage(r, s); });
      var kg = cards.reduce(function (a, r) { return a + (r.kgThis || 0); }, 0);
      var col = PALETTE[i % PALETTE.length];
      var body = cards.length
        ? cards.sort(function (a, b) { return (a.closing || "9999") < (b.closing || "9999") ? -1 : 1; }).map(cardHTML).join("")
        : '<div class="sf-col-empty">Kéo thẻ vào đây</div>';
      return '<section class="sf-col" data-stage="' + esc(s) + '">' +
        '<div class="sf-col-head" style="background:' + col + '">' +
        '<span class="sf-col-name">' + esc(stageShort(s)) + '</span>' +
        '<span class="sf-col-meta">' + cards.length + ' dự án · ' + fmt(kg) + ' KG</span></div>' +
        '<div class="sf-col-body">' + body + "</div></section>";
    }).join("");

    if (canDrag) wireDnD();
  }

  function cardHTML(r) {
    var over = r.closing && new Date(r.closing) < TODAY;
    return '<article class="sf-card" draggable="' + (!isAllNcc()) + '" data-id="' + esc(r.id) + '" onclick="SF.openRecord(\'' + esc(r.id) + '\')">' +
      '<span class="sf-card-prob">' + probPct(r) + '%</span>' +
      '<div class="sf-card-cust">' + esc(r.customer) + '</div>' +
      '<div class="sf-card-prod">' + esc(r.product) + '</div>' +
      (r.application ? '<div class="sf-card-app">' + esc(r.application) + "</div>" : "") +
      '<div class="sf-card-foot">' +
      '<span class="sf-card-kg">' + fmt(r.kgThis) + '<small>KG</small></span>' +
      '<span class="sf-card-due' + (over ? " over" : "") + '">' + (r.closing ? viDate(r.closing) : "—") + "</span>" +
      '<span class="sf-card-av" style="background:' + colorOf(r.pic) + '" title="' + esc(r.pic || "") + '">' + initials(r.pic || "?") + "</span>" +
      "</div></article>";
  }

  function uniq(a) {
    var s = {}, o = [];
    (a || []).forEach(function (x) { x = String(x == null ? "" : x).trim(); if (x && !s[x.toLowerCase()]) { s[x.toLowerCase()] = 1; o.push(x); } });
    return o;
  }
  function jsq(s) { return "'" + String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'"; }
  function groupNum(n) { return (Number(n) || 0).toLocaleString("en-US"); }   // 1,500,000,000
  function amountStr(r) { return (r.amount != null && r.amount !== "") ? groupNum(r.amount) : "—"; }

  // Trang chủ theo hướng khách hàng: mỗi KH 1 dòng, click để bung project (cây thư mục)
  function renderList(rows) {
    var box = document.getElementById("sfList");
    var map = {}, order = [];
    rows.forEach(function (r) { var k = r.customer || "—"; if (!map[k]) { map[k] = []; order.push(k); } map[k].push(r); });
    order.sort(function (a, b) { return a.localeCompare(b, "vi"); });

    var head = '<div class="sf-ct-head">' +
      '<div>Khách hàng</div>' +
      '<div class="sf-lc-hide">NCC</div>' +
      '<div class="sf-lc-hide">Nhóm ngành</div>' +
      '<div class="sf-lc-hide sf-num">Ngày khởi tạo</div>' +
      '<div class="sf-lc-hide sf-num">Closed date</div>' +
      '<div>PIC</div></div>';

    var body = order.map(function (k) {
      var ps = map[k];
      var nccs = uniq(ps.map(function (r) { return r.ncc; }));
      var groups = uniq(ps.map(function (r) { return r.group; }));
      var created = ps.map(function (r) { return r.created; }).filter(Boolean).sort()[0] || "";
      var closedArr = ps.map(function (r) { return r.closedAt || r.closing || ""; }).filter(Boolean).sort();
      var closed = closedArr.length ? closedArr[closedArr.length - 1] : "";     // muộn nhất
      var owner = (typeof customerOwnerOf === "function" && customerOwnerOf(k)) || ps[0].pic || "—";
      var open = !!expanded[k];

      var parent = '<div class="sf-ct-row' + (open ? " open" : "") + '" role="button" tabindex="0" aria-expanded="' + open + '"' +
        ' onclick="SF.toggleCustomer(' + jsq(k) + ')"' +
        ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();SF.toggleCustomer(' + jsq(k) + ')}">' +
        '<div class="sf-ct-cust"><span class="sf-ct-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>' +
          '<b>' + esc(k) + '</b><span class="sf-ct-count">' + ps.length + ' dự án</span></div>' +
        '<div class="sf-lc-hide">' + esc(nccs.join(", ") || "—") + "</div>" +
        '<div class="sf-lc-hide">' + esc(groups.join(", ") || "—") + "</div>" +
        '<div class="sf-lc-hide sf-num">' + (created ? viDate(created) : "—") + "</div>" +
        '<div class="sf-lc-hide sf-num">' + (closed ? viDate(closed) : "—") + "</div>" +
        '<div class="sf-ct-pic"><span class="sf-card-av" style="background:' + colorOf(owner) + '" title="' + esc(owner) + '">' + initials(owner) + '</span><span class="sf-ct-pic-n sf-lc-hide">' + esc(owner) + "</span></div>" +
        "</div>";

      return '<div class="sf-ct-group">' + parent + (open ? childTable(ps) : "") + "</div>";
    }).join("");

    box.innerHTML = head + body;
  }

  function childTable(ps) {
    ps = ps.slice().sort(function (a, b) { return (a.closing || "9999") < (b.closing || "9999") ? -1 : 1; });
    var h = '<div class="sf-cc-head"><div>Project</div><div>NCC</div><div>Nhóm ngành</div><div>Segment</div>' +
      '<div>Sản phẩm</div><div>Ứng dụng</div><div class="sf-num">Số lượng</div><div class="sf-num">Amount</div></div>';
    var body = ps.map(function (r) {
      return '<div class="sf-cc-row" onclick="SF.openRecord(' + jsq(r.id) + ')">' +
        '<div class="sf-cc-proj"><b>' + esc(r.id) + '</b><span class="pill ' + stageCls(r.stage) + ' sf-cc-stage"><span class="dot"></span>' + esc(stageShort(r.stage)) + "</span></div>" +
        "<div>" + esc(r.ncc || "—") + "</div>" +
        "<div>" + esc(r.group || "—") + "</div>" +
        "<div>" + esc(r.segment || "—") + "</div>" +
        '<div class="sf-cc-prod">' + esc(r.product || "—") + "</div>" +
        '<div class="sf-cc-app">' + esc(r.application || "—") + "</div>" +
        '<div class="sf-num">' + fmt(r.kgThis) + ' <small>KG</small></div>' +
        '<div class="sf-num">' + amountStr(r) + "</div>" +
        "</div>";
    }).join("");
    return '<div class="sf-cc-wrap">' + h + body + "</div>";
  }

  function toggleCustomer(k) { expanded[k] = !expanded[k]; render(); }

  /* ============================================================
     DRAG & DROP → đổi giai đoạn
     ============================================================ */
  var dragId = null;
  function wireDnD() {
    document.querySelectorAll("#sfBoard .sf-card").forEach(function (c) {
      c.addEventListener("dragstart", function (e) {
        dragId = c.dataset.id;
        c.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", dragId); } catch (x) {}
      });
      c.addEventListener("dragend", function () { c.classList.remove("dragging"); dragId = null; document.querySelectorAll(".sf-col").forEach(function (k) { k.classList.remove("drop-on"); }); });
    });
    document.querySelectorAll("#sfBoard .sf-col").forEach(function (col) {
      col.addEventListener("dragover", function (e) { e.preventDefault(); col.classList.add("drop-on"); e.dataTransfer.dropEffect = "move"; });
      col.addEventListener("dragleave", function () { col.classList.remove("drop-on"); });
      col.addEventListener("drop", function (e) {
        e.preventDefault(); col.classList.remove("drop-on");
        var id = dragId || (e.dataTransfer && e.dataTransfer.getData("text/plain"));
        moveStage(id, col.dataset.stage);
      });
    });
  }

  function moveStage(id, stage) {
    var r = recById(id); if (!r || !stage || r.stage === stage) return;
    if (!capEdit(r, me) || r.status !== "IN PROGRESS") { toast("Bạn không có quyền đổi giai đoạn dự án này."); return; }
    var oldStage = r.stage, oldProb = r.prob;
    r.stage = stage;
    if (STAGE_PROB && STAGE_PROB[stage] != null) r.prob = STAGE_PROB[stage] / 100;
    render();
    if (curId === id) buildRecord();
    persist(r, { Stage: stage, WinProbability: probPct(r) },
      "[Giai đoạn] " + stageShort(oldStage) + " → " + stageShort(stage),
      "Đã chuyển " + r.customer + " · " + r.product + " sang " + stageShort(stage) + ".",
      function () { r.stage = oldStage; r.prob = oldProb; render(); });
  }

  /* ghi SharePoint (nếu đã đăng nhập). Rollback khi lỗi. */
  function persist(r, patch, logText, okMsg, rollback) {
    if (!r.spId || !window.FISG_STORE || !FISG_STORE.canWrite || !FISG_STORE.canWrite()) {
      toast(okMsg + " (chưa đồng bộ SharePoint)"); return;
    }
    FISG_STORE.updateProject(r.spId, patch).then(function () {
      if (logText) { r.comments = r.comments || []; r.comments.push({ by: me.pic || me.name, at: nowStamp(), text: logText }); }
      if (logText) FISG_STORE.addProjectUpdate(r.spId, logText, me.pic || me.name, todayISO()).catch(function () {});
      toast(okMsg);
    }).catch(function (e) {
      if (rollback) rollback();
      toast("Không lưu được lên SharePoint: " + (e.message || e));
    });
  }

  /* ============================================================
     RECORD PAGE
     ============================================================ */
  function openRecord(id) {
    var r = recById(id); if (!r) return;
    curId = id; recTab = "timeline";
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
    var h = health(r), editable = capEdit(r, me) && r.status === "IN PROGRESS";
    var stClass = r.status === "WON" ? "won" : r.status === "LOST" ? "lost" : "run";

    el.innerHTML =
      '<div class="sf-rec-split">' +
        '<div class="sf-rec-left">' +
          highlightsHTML(r, h, stClass) +
          pathHTML(r, editable) +
          tabsHTML(r) +
          '<div class="sf-rec-main">' + tabBodyHTML(r, editable) + "</div>" +
          footHTML(r, editable) +
        "</div>" +
        '<aside class="sf-rec-side">' + sideHTML(r) + "</aside>" +
      "</div>";
    wireRecord(r, editable);
  }

  function highlightsHTML(r, h, stClass) {
    var stLabel = r.status === "WON" ? "Thắng" : r.status === "LOST" ? "Thua" : "Đang chạy";
    return '<div class="sf-hl"><div class="sf-hl-top">' +
      '<div class="sf-hl-h"><h3 id="sfRecTitle">' + esc(r.customer) + " · " + esc(r.product) + "</h3>" +
      '<div class="sf-hl-pills">' +
        '<span class="sf-hp">' + esc(r.ncc || "—") + "</span>" +
        (r.segment ? '<span class="sf-hp">' + esc(r.segment) + "</span>" : "") +
      "</div></div>" +
      '<div class="sf-hl-right">' +
        '<span class="sf-hl-status sf-stpill ' + stClass + '">' + stLabel + "</span>" +
        '<button class="sf-rec-x" onclick="SF.closeRecord()" aria-label="Đóng"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      "</div>" +
      "</div>" +
      '<div class="sf-hl-metrics">' +
        metric("Tiềm năng " + TODAY.getFullYear(), fmt(r.kgThis) + ' <small>KG</small>') +
        metric("Năm sau", fmt(r.kgNext) + ' <small>KG</small>') +
        metric("Ngày đóng DK", viDate(r.closing)) +
        metric("Tỷ lệ", probPct(r) + "%") +
      "</div></div>";
  }
  function metric(l, v) { return '<div class="sf-metric"><div class="m-l">' + l + '</div><div class="m-v">' + v + "</div></div>"; }

  function pathHTML(r, editable) {
    var pipe = pipelineOf(r.ncc);
    var cur = pipe.indexOf(r.stage);
    var closed = r.status !== "IN PROGRESS";
    return '<div class="sf-path" role="group" aria-label="Tiến trình dự án">' + pipe.map(function (s, i) {
      var cls = "sf-step";
      if (closed) { cls += r.status === "WON" ? " done" : ""; }
      else if (i < cur) cls += " done"; else if (i === cur) cls += " current";
      var clickable = editable && !closed;
      if (!clickable) cls += " locked";
      return '<button class="' + cls + '"' + (clickable ? ' onclick="SF.moveStage(\'' + esc(r.id) + "','" + esc(s).replace(/'/g, "\\'") + "')\"" : " disabled") +
        ' title="' + esc(s) + '"><span class="st-n">Bước ' + (i + 1) + "</span>" + esc(stageShort(s)) + "</button>";
    }).join("") + "</div>";
  }

  function tabsHTML(r) {
    var tabs = [{ id: "timeline", label: "Timeline" }, { id: "details", label: "Details" }, { id: "financial", label: "Financials" }];
    return '<div class="sf-rec-tabs">' + tabs.map(function (t) {
      return '<button class="sf-rec-tab' + (recTab === t.id ? " on" : "") + '" onclick="SF.setTab(\'' + t.id + '\')">' + t.label + "</button>";
    }).join("") + "</div>";
  }
  function setTab(t) { recTab = t; buildRecord(); }

  function tabBodyHTML(r, editable) {
    if (recTab === "details") return detailsTab(r, editable);
    if (recTab === "financial") return financialTab(r);
    return timelineTab(r);
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

  function timelineTab(r) {
    var ev = [];
    if (r.created) ev.push({ d: parseWhen(r.created), tag: "Tạo dự án", who: r.pic, text: "Khởi tạo cơ hội " + r.customer + " · " + r.product, kind: "start" });
    // Hoạt động khách hàng của Sale/R&D gắn với dự án này
    (typeof ACTIVITIES !== "undefined" ? ACTIVITIES : []).filter(function (a) { return a.projectId === r.id; }).forEach(function (a) {
      ev.push({ d: parseWhen(a.date), tag: "Hoạt động", who: a.pic, text: (a.type ? a.type + " — " : "") + (a.note || ""), kind: "act" });
    });
    if (r.closing) ev.push({ d: parseWhen(r.closing), tag: "Mục tiêu chốt", who: "", text: "Ngày đóng dự kiến", kind: "target" });
    ev.sort(function (a, b) { return (b.d ? b.d.getTime() : 0) - (a.d ? a.d.getTime() : 0); });
    var extSvg = '<svg class="sf-tl-ext" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h6"/></svg>';
    var body = ev.length ? ev.map(function (e) {
      var when = e.d ? e.d.toLocaleDateString("vi-VN") : (e.at || "");
      var isAct = e.kind === "act";
      var attrs = isAct ? ' role="link" tabindex="0" title="Mở hoạt động này trên tracker.fisaigon.vn"' +
        ' onclick="SF.openActivityLink(' + jsq(r.customer) + ')"' +
        ' onkeydown="if(event.key===\'Enter\'){SF.openActivityLink(' + jsq(r.customer) + ')}"' : "";
      return '<div class="sf-tl-item ' + e.kind + (isAct ? " link" : "") + '"' + attrs + '><span class="sf-tl-dot"></span>' +
        '<div class="sf-tl-c"><div class="sf-tl-top"><span class="sf-tl-tag">' + esc(e.tag) + (isAct ? extSvg : "") + '</span><span class="sf-tl-when">' + esc(when) + "</span></div>" +
        '<div class="sf-tl-text">' + esc(e.text) + (e.who ? ' <span class="sf-tl-who">· ' + esc(e.who) + "</span>" : "") + "</div></div></div>";
    }).join("") : '<div class="sf-act-empty">Chưa có hoạt động nào. Bấm “Cập nhật hoạt động” để thêm bước tiếp theo.</div>';
    var canAdd = capEdit(r, me);
    return '<div class="sf-tl-head">' +
        '<div class="sf-sec-h" style="margin:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 8v5l3 2"/><circle cx="12" cy="12" r="9"/></svg>Dòng thời gian &amp; hoạt động</div>' +
        (canAdd ? '<button class="sf-tl-add" onclick="SF.openActForm()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Cập nhật hoạt động</button>' : "") +
      "</div>" +
      '<div class="sf-timeline">' + body + "</div>";
  }

  /* mở hoạt động của khách hàng trên tracker chính (index.html = tracker.fisaigon.vn) */
  function openActivityLink(customer) {
    var url = "index.html?open=acts&q=" + encodeURIComponent(customer || "");
    window.open(url, "_blank");
  }

  /* ---------- Cập nhật hoạt động kế tiếp (sync sang list Activities) ---------- */
  function openActForm() {
    var r = recById(curId); if (!r) return;
    if (!capEdit(r, me)) { toast("Bạn không có quyền thêm hoạt động."); return; }
    var bd = document.getElementById("sfActBd") || buildActModal();
    document.getElementById("sfActSub").textContent = r.customer + " · " + (r.ncc || "");
    document.getElementById("sfAtType").value = "Call";
    document.getElementById("sfAtDate").value = (typeof todayISO === "function" ? todayISO() : new Date().toISOString().slice(0, 10));
    document.getElementById("sfAtNote").value = "";
    document.getElementById("sfAtNext").value = "";
    bd.classList.add("open");
    setTimeout(function () { document.getElementById("sfAtNote").focus(); }, 60);
  }
  function buildActModal() {
    var bd = document.createElement("div");
    bd.className = "sf-cm-bd"; bd.id = "sfActBd";
    bd.innerHTML =
      '<div class="sf-cm sf-act-modal"><div class="sf-cm-h">Cập nhật hoạt động <span id="sfActSub" style="font-weight:400;color:var(--ink-3);font-size:13px"></span></div>' +
      '<div class="sf-cm-b">' +
        '<div class="sf-af-row"><label>Loại hoạt động<select id="sfAtType"><option>Call</option><option>Visit</option><option>Email</option><option>Exhibition</option></select></label>' +
        '<label>Ngày<input type="date" id="sfAtDate"></label></div>' +
        '<label class="sf-af-full">Nội dung / mục tiêu<textarea id="sfAtNote" rows="2" placeholder="Nội dung buổi làm việc…"></textarea></label>' +
        '<label class="sf-af-full">Bước tiếp theo<input id="sfAtNext" placeholder="Hành động kế tiếp…"></label>' +
      "</div>" +
      '<div class="sf-cm-f"><button class="sf-btn ghost" onclick="SF.closeActForm()">Huỷ</button>' +
      '<button class="sf-btn primary" onclick="SF.saveActForm()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>Lưu &amp; đồng bộ</button></div></div>';
    bd.addEventListener("click", function (e) { if (e.target === bd) closeActForm(); });
    document.body.appendChild(bd);
    return bd;
  }
  function closeActForm() { var bd = document.getElementById("sfActBd"); if (bd) bd.classList.remove("open"); }
  function saveActForm() {
    var r = recById(curId); if (!r) return;
    var type = val("sfAtType") || "Call", date = val("sfAtDate") || todayISO();
    var note = (val("sfAtNote") || "").trim(), next = (val("sfAtNext") || "").trim();
    if (!note && !next) { toast("Nhập nội dung hoặc bước tiếp theo."); return; }
    var a = {
      customer: r.customer, pic: me.pic || me.name, ncc: r.ncc || "", nccs: r.ncc ? [r.ncc] : [],
      product: r.product, type: type, date: date, note: note, next: next, potential: "Medium",
      related: [], projectId: r.id, id: "A-tmp" + Date.now(), spId: null
    };
    ACTIVITIES.push(a);
    closeActForm(); buildRecord();
    var live = window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite() && r.spId;
    toast(live ? "Đã thêm hoạt động — đang đồng bộ lên tracker…" : "Đã thêm hoạt động (lưu tạm trong trình duyệt).");
    if (live) {
      FISG_STORE.createActivity(a).then(function (spId) {
        a.spId = spId; a.id = "A-" + spId; buildRecord();
        toast("Đã đồng bộ hoạt động vào Activities trên tracker.");
      }).catch(function (e) { toast("Chưa đồng bộ được lên SharePoint: " + (e.message || e)); });
    }
  }

  function detailsTab(r, editable) {
    var pipe = pipelineOf(r.ncc);
    var stageOpts = pipe.map(function (s) { return '<option value="' + esc(s) + '"' + (s === r.stage ? " selected" : "") + ">" + esc(stageShort(s)) + "</option>"; }).join("");
    var probOpts = [10, 25, 50, 75, 90, 100].map(function (p) { return '<option value="' + p + '"' + (p === probPct(r) ? " selected" : "") + ">" + p + "%</option>"; }).join("");
    return '<div class="sf-sec-h"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5"/></svg>Thông tin dự án</div>' +
      '<div class="sf-fields">' +
      field("Khách hàng", '<div class="v">' + esc(r.customer) + "</div>") +
      field("Sản phẩm", '<div class="v">' + esc(r.product) + "</div>") +
      field("Ứng dụng", '<div class="v">' + esc(r.application || "—") + "</div>") +
      (editable
        ? field("Segment", '<select id="sfSegment" onchange="SF.onSegmentChange()">' + segmentOptions(r.segment) + "</select>") +
          field("Nhóm ngành <span class=\"lbl-auto\">tự động theo Segment</span>", '<div class="v" id="sfGroupDerived">' + esc(r.group || "—") + "</div>")
        : field("Nhóm ngành · Segment", '<div class="v">' + esc(r.group || "—") + " · " + esc(r.segment || "—") + "</div>")) +
      field("Loại cơ hội", '<div class="v">' + esc(r.boptype || "—") + "</div>") +
      field("Ngày tạo", '<div class="v">' + viDate(r.created) + "</div>") +
      (editable
        ? field("Giai đoạn", '<select id="sfStage">' + stageOpts + "</select>") + field("Xác suất", '<select id="sfProb">' + probOpts + "</select>")
        : field("Giai đoạn", '<div class="v">' + esc(stageShort(r.stage)) + "</div>") + field("Xác suất", '<div class="v">' + probPct(r) + "%</div>")) +
      (editable
        ? field("Ngày đóng dự kiến", '<input type="date" id="sfClosing" value="' + (r.closing || "") + '">')
        : field("Ngày đóng dự kiến", '<div class="v">' + viDate(r.closing) + "</div>")) +
      "</div>";
  }
  function field(l, inner) { return '<div class="sf-f"><label>' + l + "</label>" + inner + "</div>"; }

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
    if (cur && !found) html = '<option value="' + esc(cur) + '" selected>' + esc(cur) + " (khác)</option>" + html;
    return html;
  }
  // chọn Segment → tự suy ra Nhóm ngành (segment group) để hiển thị
  function onSegmentChange() {
    var seg = val("sfSegment");
    var g = (typeof SEG2GROUP !== "undefined" && SEG2GROUP[seg]) || "—";
    var el = document.getElementById("sfGroupDerived");
    if (el) el.textContent = g;
  }

  function financialTab(r) {
    var canEd = capEdit(r, me);
    var total = (r.kgThis || 0) + (r.kgNext || 0);
    var amt = (r.amount != null && r.amount !== "") ? Number(r.amount) : null;
    var unit = (amt != null && total > 0) ? Math.round(amt / total) : null;   // đơn giá/kg = giá trị ước tính / tổng tiềm năng
    var amountBlock = canEd
      ? '<div class="sf-amount-edit"><input type="text" inputmode="numeric" id="sfAmount" placeholder="Nhập giá trị ước tính…" value="' + (amt != null ? groupNum(amt) : "") + '" oninput="SF.fmtAmountInput(this)">' +
        '<button class="sf-mini-btn" onclick="SF.saveAmount()">Lưu</button></div>'
      : '<div class="sf-fin"><div class="f-l">Giá trị ước tính (Amount)</div><div class="f-v">' + amountStr(r) + "</div></div>";
    return '<div class="sf-sec-h"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/></svg>Tiềm năng sản lượng</div>' +
      '<div class="sf-fin-grid">' +
      '<div class="sf-fin"><div class="f-l">Tiềm năng ' + TODAY.getFullYear() + '</div><div class="f-v">' + fmt(r.kgThis) + ' <small>KG</small></div></div>' +
      '<div class="sf-fin"><div class="f-l">Tiềm năng năm sau</div><div class="f-v">' + fmt(r.kgNext) + ' <small>KG</small></div></div>' +
      '<div class="sf-fin"><div class="f-l">Xác suất thắng</div><div class="f-v">' + probPct(r) + '%</div></div>' +
      '<div class="sf-fin"><div class="f-l">Đơn giá / Kg</div><div class="f-v">' + (unit != null ? groupNum(unit) : "—") + '</div></div>' +
      "</div>" +
      '<div class="sf-sec-h"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h3M8 15h3M14 11v6"/></svg>Giá trị ước tính (Amount)</div>' +
      amountBlock;
  }
  // định dạng ô nhập với dấu phẩy khi gõ
  function fmtAmountInput(el) {
    var digits = (el.value || "").replace(/[^0-9]/g, "");
    el.value = digits ? Number(digits).toLocaleString("en-US") : "";
  }

  function sideHTML(r) {
    var cmts = (r.comments || []).slice().sort(function (a, b) { return (a.at || "") < (b.at || "") ? -1 : 1; });
    var cmtHTML = cmts.length ? cmts.map(function (c) {
      var mine = (typeof isMine === "function") ? isMine(c.by, me)
        : ((typeof picKey === "function" ? picKey(c.by) : String(c.by || "").toUpperCase()) === (typeof picKey === "function" ? picKey(me && (me.pic || me.name)) : String((me && (me.pic || me.name)) || "").toUpperCase()));
      return '<div class="sf-cmt' + (mine ? " mine" : "") + '"><div class="sf-cmt-head"><span class="sf-cmt-by">' + esc(c.by || "—") + '</span><span class="sf-cmt-at">' + esc(c.at || "") + "</span></div>" +
        '<div class="sf-cmt-tx">' + esc(c.text || "") + "</div></div>";
    }).join("") : '<div class="sf-cmt-empty">Chưa có trao đổi nào.</div>';

    var people = (r.related && r.related.length) ? r.related.map(function (p) {
      return '<div class="sf-person"><span class="av" style="background:' + colorOf(p) + '">' + initials(p) + "</span><span>" + esc(p) + "</span></div>";
    }).join("") : '<div class="sf-side-empty">Chưa có người tham gia.</div>';

    var canPost = capEdit(r, me);

    var risk = (r.risk || "").trim();
    var riskHTML = risk ? '<div class="sf-risk-text">' + esc(risk) + "</div>"
      : '<div class="sf-side-empty">Chưa ghi nhận rủi ro.</div>';
    var riskEdit = canPost
      ? '<div class="sf-risk-edit"><input id="sfRisk" placeholder="Ghi nhận rủi ro…" value="' + esc(risk) + '"><button class="sf-mini-btn" onclick="SF.saveRisk()">Lưu</button></div>' : "";

    return '<div class="sf-sec-h"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>Trao đổi</div>' +
      '<div class="sf-chat"><div class="sf-cmts" id="sfCmts">' + cmtHTML + "</div>" +
      (canPost ? '<div class="sf-cmt-input"><input id="sfCmt" placeholder="Viết trao đổi… (Enter để gửi)"><button class="sf-send" onclick="SF.postComment()" aria-label="Gửi"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button></div>' : "") +
      "</div>" +
      '<div class="sf-sec-h"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5"/></svg>Người tham gia</div>' +
      '<div class="sf-people">' + people + "</div>" +
      '<div class="sf-sec-h danger"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/></svg>Rủi ro</div>' +
      '<div class="sf-risk">' + riskHTML + riskEdit + "</div>";
  }

  function footHTML(r, editable) {
    var canCloseIt = capClose(r, me);
    return '<div class="sf-rec-foot">' +
      (canCloseIt ? '<button class="sf-btn danger" onclick="SF.openClose()" style="margin-right:auto"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M9 3v4M15 3v4M9 13l2 2 4-4"/></svg>Đóng dự án</button>' : "<span style='margin-right:auto'></span>") +
      '<button class="sf-btn ghost" onclick="SF.closeRecord()">Đóng</button>' +
      (editable ? '<button class="sf-btn primary" onclick="SF.saveRecord()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>Lưu thay đổi</button>' : "") +
      "</div>";
  }

  function wireRecord(r, editable) {
    var cmt = document.getElementById("sfCmt");
    if (cmt) cmt.addEventListener("keydown", function (e) { if (e.key === "Enter") postComment(); });
  }

  function saveRecord() {
    var r = recById(curId); if (!r) return;
    if (!capEdit(r, me)) { toast("Bạn không có quyền sửa dự án này."); return; }
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
    if (!Object.keys(patch).length) { toast("Chưa có thay đổi nào."); return; }
    buildRecord(); render();
    persist(r, patch, changes.join(" · "), "Đã lưu thay đổi dự án " + r.customer + " · " + r.product + ".", null);
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value : null; }

  function saveRisk() {
    var r = recById(curId); if (!r) return;
    if (!capEdit(r, me)) { toast("Bạn không có quyền cập nhật rủi ro."); return; }
    var v = (val("sfRisk") || "").trim();
    r.risk = v;
    buildRecord();
    toast(v ? "Đã cập nhật rủi ro (lưu tạm trong trình duyệt — cột Rủi ro sẽ đồng bộ ở Phase 2)." : "Đã xoá ghi nhận rủi ro.");
  }

  function saveAmount() {
    var r = recById(curId); if (!r) return;
    if (!capEdit(r, me)) { toast("Bạn không có quyền cập nhật giá trị."); return; }
    var v = (val("sfAmount") || "").replace(/[^0-9]/g, "");
    r.amount = v === "" ? "" : Math.max(0, parseInt(v, 10) || 0);
    buildRecord(); render();
    toast(r.amount === "" ? "Đã xoá giá trị ước tính." : "Đã cập nhật giá trị ước tính (lưu tạm trong trình duyệt).");
  }

  function postComment() {
    var r = recById(curId); if (!r) return;
    var inp = document.getElementById("sfCmt"); if (!inp) return;
    var text = (inp.value || "").trim(); if (!text) return;
    if (!capEdit(r, me)) { toast("Bạn không có quyền trao đổi trong dự án này."); return; }
    r.comments = r.comments || [];
    r.comments.push({ by: me.pic || me.name, at: nowStamp(), text: text });
    inp.value = "";
    buildRecord();
    if (r.spId && window.FISG_STORE && FISG_STORE.canWrite && FISG_STORE.canWrite())
      FISG_STORE.addProjectUpdate(r.spId, text, me.pic || me.name, todayISO()).catch(function (e) { toast("Chưa lưu được trao đổi lên SharePoint."); });
  }

  /* ---------- close won/lost ---------- */
  function openClose() {
    var r = recById(curId); if (!r || !capClose(r, me)) { toast("Chỉ PIC hoặc Manager mới đóng được dự án."); return; }
    closePick = null;
    var bd = document.getElementById("sfCloseBd");
    if (!bd) { bd = buildCloseModal(); }
    document.getElementById("sfCloseSub").textContent = r.customer + " · " + r.product;
    document.getElementById("sfCloseReason").value = "";
    document.querySelectorAll("#sfCloseBd .sf-cm-opt").forEach(function (o) { o.classList.remove("sel"); });
    bd.classList.add("open");
  }
  function buildCloseModal() {
    var bd = document.createElement("div");
    bd.className = "sf-cm-bd"; bd.id = "sfCloseBd";
    bd.innerHTML =
      '<div class="sf-cm"><div class="sf-cm-h">Đóng dự án <span id="sfCloseSub" style="font-weight:400;color:var(--ink-3);font-size:13px"></span></div>' +
      '<div class="sf-cm-b"><div class="sf-cm-opts">' +
        '<div class="sf-cm-opt won" onclick="SF.pickClose(\'WON\',this)"><b style="color:var(--won)">Thắng</b><small>WON — chốt được đơn</small></div>' +
        '<div class="sf-cm-opt lost" onclick="SF.pickClose(\'LOST\',this)"><b style="color:var(--lost)">Thua</b><small>LOST — dừng theo đuổi</small></div>' +
      "</div>" +
      '<textarea id="sfCloseReason" placeholder="Lý do / ghi chú đóng dự án…"></textarea></div>' +
      '<div class="sf-cm-f"><button class="sf-btn ghost" onclick="SF.cancelClose()">Huỷ</button>' +
      '<button class="sf-btn primary" onclick="SF.confirmClose()">Xác nhận đóng</button></div></div>';
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
    if (!closePick) { toast("Chọn kết quả Thắng hoặc Thua."); return; }
    if (!reason) { toast("Nhập lý do đóng dự án."); return; }
    var res = closePick, label = res === "WON" ? "Thắng" : "Thua";
    r.status = res; r.prob = res === "WON" ? 1 : 0; r.closedAt = todayISO();
    r.comments = r.comments || [];
    r.comments.push({ by: me.pic || me.name, at: nowStamp(), text: "[Đóng dự án — " + label + "] " + reason });
    cancelClose(); buildRecord(); render();
    persist(r, { Status: "Closed", Result: res, WinProbability: res === "WON" ? 100 : 0 },
      "[Đóng dự án — " + label + "] " + reason,
      "Đã đóng " + r.customer + " · " + r.product + " — " + label + ".", null);
  }

  /* ---------- ESC to close ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var cb = document.getElementById("sfCloseBd");
    if (cb && cb.classList.contains("open")) { cancelClose(); return; }
    if (curId) closeRecord();
  });

  /* ---------- expose ---------- */
  window.SF = {
    render: render, setNcc: setNcc, setStatus: setStatus, setView: setView,
    openRecord: openRecord, closeRecord: closeRecord, setTab: setTab, toggleCustomer: toggleCustomer,
    moveStage: moveStage, saveRecord: saveRecord, postComment: postComment, saveRisk: saveRisk, saveAmount: saveAmount, onSegmentChange: onSegmentChange,
    openActivityLink: openActivityLink, openActForm: openActForm, closeActForm: closeActForm, saveActForm: saveActForm, fmtAmountInput: fmtAmountInput,
    openClose: openClose, pickClose: pickClose, cancelClose: cancelClose, confirmClose: confirmClose
  };
})();
