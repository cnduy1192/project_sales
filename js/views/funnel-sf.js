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
    if (!nccFilter || isAllNcc()) nccFilter = (NCCS && NCCS[0]) || "";
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
    renderStats(scoped().filter(function (r) { return r.status === "IN PROGRESS"; }));

    var board = document.getElementById("sfBoard"),
      list = document.getElementById("sfList"),
      empty = document.getElementById("sfEmpty");

    var useBoard = viewMode === "board" && statusFilter === "IN PROGRESS";
    board.hidden = !useBoard;
    list.hidden = useBoard;
    empty.hidden = true;
    var tog = document.getElementById("sfViewToggle");   // Kanban chỉ có nghĩa với dự án đang chạy
    tog.style.opacity = statusFilter === "IN PROGRESS" ? "" : "0.4";
    tog.style.pointerEvents = statusFilter === "IN PROGRESS" ? "" : "none";

    if (!rows.length) {
      board.hidden = true; list.hidden = true; empty.hidden = false;
      empty.innerHTML =
        '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/></svg>' +
        "<b>Không có dự án nào</b><span>Thử đổi nhà cung cấp, bộ lọc trạng thái, hoặc từ khoá tìm kiếm.</span>";
      return;
    }
    if (useBoard) renderBoard(rows); else renderList(rows);
  }

  function renderStats(open) {
    var kg = open.reduce(function (s, r) { return s + (r.kgThis || 0); }, 0);
    var w = open.reduce(function (s, r) { return s + (r.kgThis || 0) * (r.prob || 0); }, 0);
    document.getElementById("sfStats").innerHTML =
      '<div class="sf-stat"><b>' + open.length + '</b><small>đang chạy</small></div>' +
      '<div class="sf-stat"><b>' + fmt(kg) + '</b><small>KG tiềm năng</small></div>' +
      '<div class="sf-stat"><b>' + fmt(Math.round(w)) + '</b><small>KG trọng số</small></div>';
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

  function renderList(rows) {
    rows.sort(function (a, b) { return (a.closing || "9999") < (b.closing || "9999") ? -1 : 1; });
    var box = document.getElementById("sfList");
    var head = '<div class="sf-lrow head"><div>Khách hàng</div><div class="sf-lc-hide">Ứng dụng</div>' +
      '<div class="sf-lc-hide">Sản phẩm</div><div class="sf-lc-hide">Giai đoạn</div><div>Xác suất</div>' +
      '<div class="sf-lkg">KG</div><div class="sf-lc-hide">PIC</div></div>';
    var body = rows.map(function (r) {
      var h = health(r);
      return '<div class="sf-lrow" onclick="SF.openRecord(\'' + esc(r.id) + '\')">' +
        '<div><b>' + esc(r.customer) + '</b><div class="sf-lcell-sub">đóng ' + (r.closing ? viDate(r.closing) : "—") + "</div></div>" +
        '<div class="sf-lc-hide">' + esc(r.application || "—") + "</div>" +
        '<div class="sf-lc-hide">' + esc(r.product) + "</div>" +
        '<div class="sf-lc-hide"><span class="pill ' + stageCls(r.stage) + '"><span class="dot"></span>' + esc(stageShort(r.stage)) + "</span></div>" +
        "<div>" + probPct(r) + "%</div>" +
        '<div class="sf-lkg">' + fmt(r.kgThis) + "</div>" +
        '<div class="sf-lc-hide"><span class="sf-card-av" style="background:' + colorOf(r.pic) + '">' + initials(r.pic || "?") + "</span></div>" +
        "</div>";
    }).join("");
    box.innerHTML = head + body;
  }

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
    curId = id; recTab = "overview";
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
      highlightsHTML(r, h, stClass) +
      pathHTML(r, editable) +
      tabsHTML(r) +
      '<div class="sf-rec-body">' +
        '<div class="sf-rec-main">' + tabBodyHTML(r, editable) + "</div>" +
        '<aside class="sf-rec-side">' + sideHTML(r) + "</aside>" +
      "</div>" +
      footHTML(r, editable);
    wireRecord(r, editable);
  }

  function highlightsHTML(r, h, stClass) {
    var stLabel = r.status === "WON" ? "Thắng" : r.status === "LOST" ? "Thua" : "Đang chạy";
    return '<div class="sf-hl"><div class="sf-hl-top">' +
      '<div class="sf-hl-mark">' + initials(r.customer) + "</div>" +
      '<div class="sf-hl-h"><h3 id="sfRecTitle">' + esc(r.customer) + " · " + esc(r.product) + "</h3>" +
      '<div class="sf-hl-pills">' +
        '<span class="sf-hp">' + esc(r.ncc || "—") + "</span>" +
        (r.segment ? '<span class="sf-hp">' + esc(r.segment) + "</span>" : "") +
        (r.application ? '<span class="sf-hp">' + esc(r.application) + "</span>" : "") +
        '<span class="sf-hp"><span class="sf-stpill ' + stClass + '">' + stLabel + "</span></span>" +
        '<span class="sf-hp">PIC ' + esc(r.pic || "—") + "</span>" +
      "</div></div>" +
      '<button class="sf-rec-x" onclick="SF.closeRecord()" aria-label="Đóng"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      "</div>" +
      '<div class="sf-hl-metrics">' +
        metric("Tiềm năng " + TODAY.getFullYear(), fmt(r.kgThis) + ' <small>KG</small>') +
        metric("Năm sau", fmt(r.kgNext) + ' <small>KG</small>') +
        metric("Ngày đóng DK", '<span style="font-size:16px">' + viDate(r.closing) + "</span>") +
        '<div class="sf-metric"><div class="m-l">Xác suất · Sức khỏe</div><div class="m-v">' + probPct(r) + "%</div>" +
          '<div class="sf-health ' + h.cls + '"><i></i>' + h.label + "</div></div>" +
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
    var tabs = [
      { id: "overview", label: "Tổng quan" },
      { id: "activity", label: "Hoạt động" },
      { id: "financial", label: "Tài chính" },
      { id: "delivery", label: "Giao hàng", lock: r.status !== "WON" }
    ];
    return '<div class="sf-rec-tabs">' + tabs.map(function (t) {
      return '<button class="sf-rec-tab' + (recTab === t.id ? " on" : "") + '" onclick="SF.setTab(\'' + t.id + '\')">' +
        t.label + (t.lock ? '<span class="lock">🔒</span>' : "") + "</button>";
    }).join("") + "</div>";
  }
  function setTab(t) { recTab = t; buildRecord(); }

  function tabBodyHTML(r, editable) {
    if (recTab === "activity") return activityTab(r);
    if (recTab === "financial") return financialTab(r);
    if (recTab === "delivery") return deliveryTab(r);
    return overviewTab(r, editable);
  }

  function overviewTab(r, editable) {
    var pipe = pipelineOf(r.ncc);
    var stageOpts = pipe.map(function (s) { return '<option value="' + esc(s) + '"' + (s === r.stage ? " selected" : "") + ">" + esc(stageShort(s)) + "</option>"; }).join("");
    var probOpts = [10, 25, 50, 75, 90, 100].map(function (p) { return '<option value="' + p + '"' + (p === probPct(r) ? " selected" : "") + ">" + p + "%</option>"; }).join("");
    return '<div class="sf-sec-h"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5"/></svg>Thông tin dự án</div>' +
      '<div class="sf-fields">' +
      field("Khách hàng", '<div class="v">' + esc(r.customer) + "</div>") +
      field("Sản phẩm", '<div class="v">' + esc(r.product) + "</div>") +
      field("Ứng dụng", '<div class="v">' + esc(r.application || "—") + "</div>") +
      field("Nhóm ngành · Segment", '<div class="v">' + esc(r.group || "—") + " · " + esc(r.segment || "—") + "</div>") +
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

  function activityTab(r) {
    var acts = (typeof ACTIVITIES !== "undefined" ? ACTIVITIES : []).filter(function (a) { return a.projectId === r.id; })
      .sort(function (a, b) { return (b.date || "") < (a.date || "") ? -1 : 1; });
    var list = acts.length ? acts.map(function (a) {
      return '<div class="sf-act"><div class="a-t">' + esc(a.type || "Hoạt động") + " · " + esc(a.customer) + "</div>" +
        '<div class="a-m">' + viDate(a.date) + " · " + esc(a.pic || "—") + (a.note ? " — " + esc(a.note) : "") + "</div></div>";
    }).join("") : '<div class="sf-act-empty">Chưa có hoạt động nào gắn với dự án này. Tạo hoạt động trong app chính và gắn dự án để hiện ở đây.</div>';
    return '<div class="sf-sec-h"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h4l3 8 4-16 3 8h4"/></svg>Hoạt động khách hàng liên quan</div>' + list;
  }

  function financialTab(r) {
    var weighted = Math.round((r.kgThis || 0) * (r.prob || 0));
    return '<div class="sf-sec-h"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M7 7h7a3 3 0 010 6H8a3 3 0 000 6h8"/></svg>Tiềm năng sản lượng</div>' +
      '<div class="sf-fin-grid">' +
      '<div class="sf-fin"><div class="f-l">Tiềm năng ' + TODAY.getFullYear() + '</div><div class="f-v">' + fmt(r.kgThis) + ' <small>KG</small></div></div>' +
      '<div class="sf-fin"><div class="f-l">Tiềm năng năm sau</div><div class="f-v">' + fmt(r.kgNext) + ' <small>KG</small></div></div>' +
      '<div class="sf-fin"><div class="f-l">Xác suất thắng</div><div class="f-v">' + probPct(r) + '%</div></div>' +
      '<div class="sf-fin"><div class="f-l">Sản lượng trọng số (KG × %)</div><div class="f-v">' + fmt(weighted) + ' <small>KG</small></div></div>' +
      "</div>";
  }

  function deliveryTab(r) {
    if (r.status !== "WON") {
      return '<div class="sf-lock-note"><b>Giao hàng mở khoá khi dự án WIN</b>' +
        "Khi cơ hội được đóng <b>Thắng</b>, không gian giao hàng kiểu Salesforce (Milestone, Project Task Kanban, Gantt, phân bổ nhân sự) sẽ mở ở đây." +
        '<div class="k">Đây là Phase 2 — cần 4 SharePoint List mới (ProjectTasks, Milestones, ProjectRisks, ResourceAssignments).</div></div>';
    }
    return '<div class="sf-lock-note"><b>Sẵn sàng cho Phase 2</b>' +
      "Dự án đã WIN. Module giao hàng (Milestone · Task Kanban · Gantt · Resource) sẽ được kích hoạt ở Phase 2." +
      '<div class="k">Xác nhận triển khai Phase 2 để bắt đầu.</div></div>';
  }

  function sideHTML(r) {
    var cmts = (r.comments || []).slice().sort(function (a, b) { return (a.at || "") < (b.at || "") ? -1 : 1; });
    var cmtHTML = cmts.length ? cmts.map(function (c) {
      return '<div class="sf-cmt"><div class="sf-cmt-head"><span class="sf-cmt-by">' + esc(c.by || "—") + '</span><span class="sf-cmt-at">' + esc(c.at || "") + "</span></div>" +
        '<div class="sf-cmt-tx">' + esc(c.text || "") + "</div></div>";
    }).join("") : '<div class="sf-cmt-empty">Chưa có trao đổi nào.</div>';

    var people = (r.related && r.related.length) ? r.related.map(function (p) {
      return '<div class="sf-person"><span class="av" style="background:' + colorOf(p) + '">' + initials(p) + "</span><span>" + esc(p) + "</span></div>";
    }).join("") : '<div class="sf-side-empty">Chưa có người tham gia.</div>';

    var canPost = capEdit(r, me);
    return '<div class="sf-sec-h"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>Trao đổi trong dự án</div>' +
      '<div class="sf-chat"><div class="sf-cmts" id="sfCmts">' + cmtHTML + "</div>" +
      (canPost ? '<div class="sf-cmt-input"><input id="sfCmt" placeholder="Viết trao đổi… (Enter để gửi)"><button class="sf-send" onclick="SF.postComment()" aria-label="Gửi"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button></div>' : "") +
      "</div>" +
      '<div class="sf-sec-h"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5"/></svg>Người tham gia</div>' +
      '<div class="sf-people">' + people + "</div>";
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
    if (!Object.keys(patch).length) { toast("Chưa có thay đổi nào."); return; }
    buildRecord(); render();
    persist(r, patch, changes.join(" · "), "Đã lưu thay đổi dự án " + r.customer + " · " + r.product + ".", null);
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value : null; }

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
    openRecord: openRecord, closeRecord: closeRecord, setTab: setTab,
    moveStage: moveStage, saveRecord: saveRecord, postComment: postComment,
    openClose: openClose, pickClose: pickClose, cancelClose: cancelClose, confirmClose: confirmClose
  };
})();
