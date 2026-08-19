/* report-page.js — logic trang báo cáo dành cho quản lý (report.html).
   Đọc list Reports / ReportComments / Users qua FISG_GRAPH. Không dùng store.js.
   Chi tiết + số liệu + biểu đồ lấy từ cột "Số liệu" (StatsJson) đã chốt khi gửi. */
(function () {
  "use strict";

  /* ---------- Nhãn cột (khớp js/store.js) ---------- */
  const LABELS = {
    Reports: { PICName: "Người gửi", WeekLabel: "Tuần", ReportDate: "Ngày gửi",
               Content: "Nhận xét", StatsJson: "Số liệu", Recipients: "Người nhận" },
    ReportComments: { ReportCode: "Mã báo cáo", PICName: "Người viết",
                      AuthorRole: "Vai trò", CommentDate: "Ngày", Content: "Nội dung" },
    Users: { Email: "Email", PICName: "Tên PIC", Role: "Vai trò",
             FullName: "Tên đầy đủ", ReportsTo: "Báo cáo cho", Supports: "Hỗ trợ sales" },
  };
  const DONUT = ['#01426A', '#0E7490', '#B45309', '#6D28D9', '#0D9488', '#DB2777', '#157F3C'];

  /* ---------- Tiện ích ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function stripDia(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D");
  }
  function picKey(s) { return stripDia(s).toUpperCase().replace(/\s+/g, " ").trim(); }
  function vn(iso) {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d.toLocaleDateString("vi-VN") : (iso || "");
  }
  function txt(v) {
    if (v == null) return "";
    if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(", ");
    if (typeof v === "object")
      return v.LookupValue || v.Label || v.displayName || v.Title || v.Value || "";
    return String(v);
  }
  function firstAlias(s) {
    return String(s == null ? "" : s).split(/[,;|]/).map(x => x.trim()).filter(Boolean)[0] || "";
  }
  function roleKey(raw) {
    const r = (typeof roleFromText === "function" && roleFromText(raw)) || "";
    return r || String(raw || "sales").toLowerCase().trim();
  }
  function scopeOf(role) {
    return (typeof cap === "function" ? cap(role) : { scope: "" }).scope;
  }
  function roleVI(role) {
    return (typeof roleLabel === "function" ? roleLabel(role) : role) || role;
  }

  /* Getter: cols = {internalName: displayName}. Đọc theo khoá logic trong LABELS. */
  function makeGetter(cols, labels) {
    const internals = new Set(Object.keys(cols || {}));
    const byDisplay = {};
    Object.keys(cols || {}).forEach(k => { if (!(cols[k] in byDisplay)) byDisplay[cols[k]] = k; });
    return function get(fields, key) {
      let a = null;
      if (internals.has(key)) a = key;
      else if (labels[key] && byDisplay[labels[key]]) a = byDisplay[labels[key]];
      else if (byDisplay[key]) a = byDisplay[key];
      if (!a) return "";
      let v = fields[a];
      if (v === undefined) v = fields[a + "LookupId"];
      return txt(v);
    };
  }

  /* ---------- Trạng thái ---------- */
  const S = { me: null, reports: [], filterPic: "", filterWeek: "", selId: null };
  let chart = null;

  /* ---------- Chuyển trạng thái toàn trang ---------- */
  const PANES = ["rpxLoading", "rpxSignin", "rpxDenied", "rpxPortal"];
  function show(pane, msg) {
    PANES.forEach(p => { const el = document.getElementById(p); if (el) el.hidden = p !== pane; });
    if (pane === "rpxLoading" && msg) {
      const m = document.getElementById("rpxLoadingMsg"); if (m) m.textContent = msg;
    }
    const user = document.getElementById("rpxUser");
    if (user) user.hidden = pane !== "rpxPortal";
  }
  window.REPORT_SHOW_SIGNIN = function () { show("rpxSignin"); };

  /* ---------- Vào trang sau khi đăng nhập ---------- */
  window.REPORT_ON_AUTH = async function (account) {
    show("rpxLoading", "Đang kiểm tra quyền truy cập…");
    try {
      const me = await resolveMe(account);
      if (!me) {
        deny("Tài khoản " + (account && account.username) + " chưa có trong danh bạ Users trên "
             + "SharePoint. Nhờ quản trị thêm dòng: Email · Tên PIC · Vai trò.");
        return;
      }
      S.me = me;
      if (scopeOf(me.role) !== "all") {
        deny("Tài khoản của bạn (" + roleVI(me.role) + ") không có quyền xem báo cáo toàn đội. "
             + "Trang này chỉ dành cho Manager, Director hoặc Super Admin.");
        return;
      }
      paintUser(me);
      show("rpxLoading", "Đang tải báo cáo…");
      await loadData();
      enterPortal();
    } catch (e) {
      console.error("[report] lỗi khởi tạo:", e);
      deny("Không tải được dữ liệu: " + ((e && e.message) || e));
    }
  };

  function deny(msg) {
    const el = document.getElementById("rpxDeniedMsg");
    if (el) el.textContent = msg;
    show("rpxDenied");
  }
  function paintUser(me) {
    const n = document.getElementById("rpxUserName");
    const r = document.getElementById("rpxUserRole");
    if (n) n.textContent = me.name || me.pic || me.email;
    if (r) r.textContent = roleVI(me.role);
  }

  /* ---------- Tra Users để biết vai trò người đăng nhập ---------- */
  async function resolveMe(account) {
    const mail = String((account && account.username) || "").toLowerCase();
    const [cols, items] = await Promise.all([
      FISG_GRAPH.columns("Users"), FISG_GRAPH.listItems("Users"),
    ]);
    const g = makeGetter(cols, LABELS.Users);
    for (const it of items) {
      const f = it.fields || {};
      const email = (g(f, "Email") || txt(f.Title)).toLowerCase();
      if (email !== mail) continue;
      const pic = g(f, "FullName") || firstAlias(g(f, "PICName")) || (account && account.name) || email;
      return { email, pic, role: roleKey(g(f, "Role")), name: (account && account.name) || pic };
    }
    return null;
  }

  /* ---------- Đọc Reports + ReportComments ---------- */
  async function loadData() {
    const [rCols, rItems] = await Promise.all([
      FISG_GRAPH.columns("Reports"), FISG_GRAPH.listItems("Reports"),
    ]);
    const gr = makeGetter(rCols, LABELS.Reports);

    let cItems = [], gc = null;
    try {
      const [cCols, ci] = await Promise.all([
        FISG_GRAPH.columns("ReportComments"), FISG_GRAPH.listItems("ReportComments"),
      ]);
      gc = makeGetter(cCols, LABELS.ReportComments); cItems = ci;
    } catch (e) { cItems = []; }

    const byCode = {};
    cItems.forEach(it => {
      const f = it.fields || {};
      const code = gc(f, "ReportCode") || txt(f.Title);
      if (!code) return;
      (byCode[code] = byCode[code] || []).push({
        by: gc(f, "PICName"), role: gc(f, "AuthorRole"),
        at: (gc(f, "CommentDate") || "").slice(0, 10), text: gc(f, "Content"),
      });
    });
    Object.keys(byCode).forEach(k =>
      byCode[k].sort((a, b) => (a.at || "").localeCompare(b.at || "")));

    S.reports = rItems.map(it => {
      const f = it.fields || {};
      const code = txt(f.Title);
      let snap = {};
      try { snap = JSON.parse(gr(f, "StatsJson") || "{}"); } catch (e) { snap = {}; }
      const pic = gr(f, "PICName") || "";
      return {
        id: code || String(it.id), code: code || String(it.id),
        pic, picLabel: pic,
        weekLabel: gr(f, "WeekLabel") || snap.weekLabel || "",
        createdAt: (gr(f, "ReportDate") || "").slice(0, 10) || snap.createdAt || "",
        note: gr(f, "Content"),
        stats: snap.stats || { done: 0, missed: 0, changes: 0, overdue: 0, open: 0 },
        doneActs: snap.doneActs || [], missedActs: snap.missedActs || [],
        projectChanges: snap.projectChanges || [],
        comments: byCode[code] || [],
      };
    }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  /* ---------- Vào cổng chính ---------- */
  function enterPortal() {
    renderFilters();
    // Deep-link ?id=
    const want = new URLSearchParams(location.search).get("id");
    if (want && S.reports.some(r => r.code === want)) S.selId = want;
    else if (want) toast("Không tìm thấy báo cáo — hiển thị tất cả.");
    show("rpxPortal");
    renderList();
    renderDetail();
    wireStaticButtons();
  }

  function filtered() {
    return S.reports.filter(r =>
      (!S.filterPic || picKey(r.pic) === picKey(S.filterPic)) &&
      (!S.filterWeek || r.weekLabel === S.filterWeek));
  }

  function renderFilters() {
    const selP = document.getElementById("rpxFilterPic");
    const selW = document.getElementById("rpxFilterWeek");
    if (selP) {
      const pics = Array.from(new Set(S.reports.map(r => r.pic).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, "vi"));
      selP.innerHTML = '<option value="">Tất cả sales</option>' +
        pics.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
      selP.value = S.filterPic;
      selP.onchange = () => { S.filterPic = selP.value; S.selId = null; renderList(); renderDetail(); };
    }
    if (selW) {
      const weeks = Array.from(new Set(S.reports.map(r => r.weekLabel).filter(Boolean)));
      selW.innerHTML = '<option value="">Tất cả tuần</option>' +
        weeks.map(w => `<option value="${esc(w)}">${esc(w)}</option>`).join("");
      selW.value = S.filterWeek;
      selW.onchange = () => { S.filterWeek = selW.value; S.selId = null; renderList(); renderDetail(); };
    }
  }

  function renderList() {
    const box = document.getElementById("rpxList");
    const list = filtered();
    if (!list.length) {
      box.innerHTML = `<div class="rpx-empty"><b>Chưa có báo cáo nào</b>
        <p>Không có báo cáo khớp bộ lọc hiện tại.</p></div>`;
      return;
    }
    box.innerHTML = list.map(r => {
      const nc = (r.comments || []).length;
      const s = r.stats || {};
      return `<button class="rpx-row${S.selId === r.code ? " on" : ""}" role="listitem"
        type="button" data-id="${esc(r.code)}">
        <b>${esc(r.picLabel)} — tuần ${esc(r.weekLabel)}</b>
        <span class="rpx-row-w">${vn(r.createdAt)}${nc ? ` · <span class="rpx-cc">${nc} phản hồi</span>` : ""}</span>
        <span class="rpx-row-s">${s.done || 0} đã làm · ${s.missed || 0} chưa xong · ${s.changes || 0} thay đổi</span>
      </button>`;
    }).join("");
    box.querySelectorAll(".rpx-row").forEach(b =>
      b.addEventListener("click", () => selectReport(b.dataset.id)));
  }

  function selectReport(id) {
    S.selId = id;
    const u = new URL(location.href);
    if (id) u.searchParams.set("id", id); else u.searchParams.delete("id");
    history.replaceState(null, "", u);
    renderList();
    renderDetail();
  }

  function renderDetail() {
    const box = document.getElementById("rpxDetail");
    const r = filtered().find(x => x.code === S.selId) || S.reports.find(x => x.code === S.selId);
    if (chart) { try { chart.destroy(); } catch (e) {} chart = null; }

    if (!r) {
      box.innerHTML = `<div class="rpx-empty rpx-empty-lg">
        <b>Chọn một báo cáo để đọc</b>
        <p>Bấm một dòng bên trái để xem chi tiết tuần làm việc của sales.</p></div>`;
      return;
    }

    const s = r.stats || {};
    const sec = (title, items, render) => `
      <div class="rpx-sec"><div class="rpx-sec-h"><h3>${title}</h3><span>${items.length}</span></div>
      ${items.length ? items.map(render).join("") : '<div class="rpx-muted">Không có mục nào.</div>'}</div>`;

    box.innerHTML = `
      <h2>${esc(r.picLabel)} — tuần ${esc(r.weekLabel)}</h2>
      <div class="rpx-meta">Đã gửi ${vn(r.createdAt)} · Mã ${esc(r.code)}</div>

      <div class="rpx-actions">
        <button class="rpx-btn-ghost" id="rpxExport" type="button">Xuất Excel</button>
      </div>

      <div class="rpx-stats">
        <div class="rpx-stat s-done"><b>${s.done || 0}</b><span>Đã làm</span></div>
        <div class="rpx-stat s-miss"><b>${s.missed || 0}</b><span>Chưa hoàn thành</span></div>
        <div class="rpx-stat s-chg"><b>${s.changes || 0}</b><span>Thay đổi dự án</span></div>
        <div class="rpx-stat s-over"><b>${s.overdue || 0}</b><span>Quá hạn</span></div>
      </div>

      <div class="rpx-chart-wrap">
        <h4>Phân loại hoạt động đã làm</h4>
        <div class="rpx-chart"><canvas id="rpxChart"></canvas></div>
        <div class="rpx-legend" id="rpxLegend"></div>
      </div>

      ${sec("Hoạt động đã làm", r.doneActs, a => `
        <div class="rpx-item"><div class="rpx-item-t">
          <span class="rpx-item-n">${esc(a.custLabel || a.customer || "—")}</span>
          <span class="rpx-tag">${esc(a.type || "—")}</span>
          <span class="rpx-kg">${vn(a.date)}</span></div>
          <div class="rpx-item-r">${esc(a.note || "—")}</div></div>`)}

      ${r.missedActs.length ? sec("Kế hoạch chưa hoàn thành", r.missedActs, a => `
        <div class="rpx-item"><div class="rpx-item-t">
          <span class="rpx-item-n">${esc(a.custLabel || a.customer || "—")}</span>
          <span class="rpx-badge warn">${vn(a.date)}</span></div>
          <div class="rpx-item-r">${esc(a.note || "—")}</div></div>`) : ""}

      ${sec("Thay đổi dự án", (r.projectChanges || []).slice(0, 20), c => `
        <div class="rpx-item"><div class="rpx-item-t">
          <span class="rpx-item-n">${esc(c.custLabel || c.customer || "—")}</span>
          <span class="rpx-kg">${vn(c.ts)}</span></div>
          <div class="rpx-item-r">${esc(c.product || "")}${c.text ? " — " + esc(String(c.text).slice(0, 140)) : ""}</div></div>`)}

      <div class="rpx-sec">
        <div class="rpx-sec-h"><h3>Nội dung báo cáo</h3></div>
        <div class="rpx-note">${esc(r.note || "Không có nội dung.")}</div>
      </div>

      ${threadHtml(r)}`;

    drawChart(r);
    const exp = document.getElementById("rpxExport");
    if (exp) exp.addEventListener("click", () => exportExcel(r));
    const send = document.getElementById("rpxCmtSend");
    if (send) send.addEventListener("click", () => postComment(r));
  }

  function threadHtml(r) {
    const cmts = r.comments || [];
    const list = cmts.length ? cmts.map(c => {
      const mine = S.me && picKey(c.by) === picKey(S.me.pic);
      const lead = c.role && scopeOf(roleKey(c.role)) === "all";
      return `<div class="rpx-cmt${mine ? " me" : ""}">
        <div class="rpx-cmt-h"><b>${esc(c.by || "—")}</b>
          ${lead ? '<span class="rpx-cmt-tag">Quản lý</span>' : ""}
          <span>${vn(c.at)}</span></div>
        <div class="rpx-cmt-b">${esc(c.text || "")}</div></div>`;
    }).join("") : '<div class="rpx-muted">Chưa có phản hồi nào.</div>';

    return `<div class="rpx-sec rpx-thread">
      <div class="rpx-sec-h"><h3>Trao đổi</h3><span>${cmts.length}</span></div>
      <div class="rpx-thread-list">${list}</div>
      <div class="rpx-cmt-form">
        <textarea id="rpxCmt" rows="2" placeholder="Phản hồi cho ${esc(r.picLabel)}…"></textarea>
        <button class="rpx-btn-primary" id="rpxCmtSend" type="button">Gửi phản hồi</button>
      </div></div>`;
  }

  async function postComment(r) {
    const el = document.getElementById("rpxCmt");
    const text = el ? el.value.trim() : "";
    if (!text) { toast("Nhập nội dung phản hồi."); return; }
    const btn = document.getElementById("rpxCmtSend");
    if (btn) { btn.disabled = true; btn.textContent = "Đang gửi…"; }
    try {
      const cCols = await FISG_GRAPH.columns("ReportComments");
      const byDisplay = {};
      Object.keys(cCols).forEach(k => { if (!(cCols[k] in byDisplay)) byDisplay[cCols[k]] = k; });
      const field = (logical) => byDisplay[LABELS.ReportComments[logical]] || logical;
      const f = { Title: String(r.code) };
      f[field("ReportCode")] = r.code;
      f[field("PICName")] = S.me.pic || "";
      f[field("AuthorRole")] = S.me.role || "";
      f[field("CommentDate")] = new Date().toISOString().slice(0, 10);
      f[field("Content")] = text;
      await FISG_GRAPH.createItem("ReportComments", f);
      r.comments = (r.comments || []).concat([{
        by: S.me.pic, role: S.me.role, at: new Date().toISOString().slice(0, 10), text,
      }]);
      renderList(); renderDetail();
      toast("Đã gửi phản hồi. Sales sẽ nhận email thông báo.");
    } catch (e) {
      console.error("[report] gửi phản hồi hỏng:", e);
      toast("CHƯA gửi được phản hồi: " + ((e && e.message) || e));
      if (btn) { btn.disabled = false; btn.textContent = "Gửi phản hồi"; }
    }
  }

  /* ---------- Biểu đồ ---------- */
  function drawChart(r) {
    const byType = {};
    (r.doneActs || []).forEach(a => {
      const k = a.type || "Khác"; byType[k] = (byType[k] || 0) + 1;
    });
    const items = Object.keys(byType).map((k, i) =>
      ({ label: k, value: byType[k], color: DONUT[i % DONUT.length] }));
    const total = items.reduce((n, i) => n + i.value, 0);
    const leg = document.getElementById("rpxLegend");
    const cv = document.getElementById("rpxChart");
    if (!total || !cv) {
      if (leg) leg.innerHTML = "";
      if (cv) cv.closest(".rpx-chart-wrap").classList.add("empty");
      return;
    }
    if (window.Chart) {
      chart = new Chart(cv, {
        type: "doughnut",
        data: { labels: items.map(i => i.label),
          datasets: [{ data: items.map(i => i.value), backgroundColor: items.map(i => i.color),
            borderWidth: 2, borderColor: "#fff", hoverOffset: 6 }] },
        options: { cutout: "66%", responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false },
            tooltip: { callbacks: { label: c => " " + c.parsed + " · " +
              Math.round(100 * c.parsed / total) + "%" } } } },
      });
    }
    if (leg) leg.innerHTML = items.map(i =>
      `<div class="li"><span class="sw" style="background:${i.color}"></span>${esc(i.label)}
       <b>${i.value}</b><small>${Math.round(100 * i.value / total)}%</small></div>`).join("");
  }

  /* ---------- Xuất Excel ---------- */
  function exportExcel(r) {
    if (typeof XLSX === "undefined") { toast("Thư viện Excel chưa tải xong, thử lại."); return; }
    const s = r.stats || {}, rows = [], push = (...c) => rows.push(c);
    push("BÁO CÁO TUẦN", r.weekLabel || "");
    push("Người thực hiện", r.picLabel || r.pic || "");
    push("Ngày gửi", vn(r.createdAt));
    push();
    push("Đã làm", s.done || 0, "Chưa hoàn thành", s.missed || 0,
         "Thay đổi dự án", s.changes || 0, "Quá hạn", s.overdue || 0);
    push();
    push("HOẠT ĐỘNG ĐÃ LÀM");
    push("Ngày", "Khách hàng", "Loại", "Nội dung", "Next step");
    (r.doneActs || []).forEach(a =>
      push(vn(a.date), a.custLabel || a.customer || "", a.type || "", a.note || "", a.next || ""));
    push();
    push("KẾ HOẠCH CHƯA HOÀN THÀNH");
    push("Ngày", "Khách hàng", "Nội dung");
    (r.missedActs || []).forEach(a => push(vn(a.date), a.custLabel || a.customer || "", a.note || ""));
    push();
    push("THAY ĐỔI DỰ ÁN");
    push("Ngày", "Khách hàng", "Sản phẩm", "Nội dung");
    (r.projectChanges || []).forEach(c => push(vn(c.ts), c.custLabel || "", c.product || "", c.text || ""));
    push();
    push("NỘI DUNG BÁO CÁO");
    push(r.note || "Không có nội dung.");

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 13 }, { wch: 30 }, { wch: 14 }, { wch: 44 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo");
    const safe = String(r.picLabel || r.pic || "bao-cao").replace(/[^\p{L}\p{N}]+/gu, "_");
    const wk = String(r.weekLabel || "").replace(/[^\p{L}\p{N}]+/gu, "_");
    XLSX.writeFile(wb, "BaoCao_" + safe + "_" + wk + ".xlsx");
  }

  /* ---------- Nút tĩnh + toast ---------- */
  let wired = false;
  function wireStaticButtons() {
    if (wired) return; wired = true;
    const out1 = document.getElementById("rpxSignOut");
    const out2 = document.getElementById("rpxDeniedSignOut");
    if (out1) out1.addEventListener("click", () => FISG_AUTH.signOut());
    if (out2) out2.addEventListener("click", () => FISG_AUTH.signOut());
  }
  function wireSignIn() {
    const btn = document.getElementById("rpxSignIn");
    if (btn) btn.addEventListener("click", () => FISG_AUTH.signIn());
    wireStaticButtons();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", wireSignIn);
  else wireSignIn();

  let toastT = null;
  function toast(msg) {
    let el = document.getElementById("rpxToast");
    if (!el) {
      el = document.createElement("div"); el.id = "rpxToast"; el.className = "rpx-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg; el.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove("on"), 3200);
  }
  window.__rpxToast = toast;
})();
