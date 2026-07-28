/* js/extras.js — Ba chức năng mở rộng (nạp CUỐI).
 * 1) Thêm nhà cung cấp — chọn mô hình pipeline của NCC đang có để áp dụng
 * 2) Click hoạt động khách hàng -> bảng chi tiết toàn bộ dữ liệu của khách đó
 * 3) Biểu đồ tỷ trọng Segment trong Dashboard
 */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s)
    .replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtN = n => (Number(n) || 0).toLocaleString("vi-VN");
  const viDay = d => d ? new Date(d).toLocaleDateString("vi-VN") : "—";
  const NCC_COLOR = { Roquette: "#1E3A8A", IFF: "#0D9488", Kimica: "#7C3AED" };
  const EXTRA_COLORS = ["#B45309", "#0B4F9E", "#DB2777", "#059669", "#9333EA"];
  const colorOf = (n, i) => NCC_COLOR[n] || EXTRA_COLORS[i % EXTRA_COLORS.length];

  /* ================= 1. THÊM NHÀ CUNG CẤP ================= */
  const LS_KEY = "fisg_custom_nccs";
  const loadCustom = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } };
  const saveCustom = a => { try { localStorage.setItem(LS_KEY, JSON.stringify(a)); } catch (e) {} };

  function applySupplier(name, stages, probs, groups) {
    if (typeof LISTS === "undefined") return;
    if (!LISTS.nccs.includes(name)) LISTS.nccs.push(name);
    LISTS.pipelines[name] = stages.slice();
    stages.forEach(s => {
      if (groups && groups[s] && !LISTS.groupOf[s]) LISTS.groupOf[s] = groups[s];
      if (probs && probs[s] != null && LISTS.probOf[s] == null) LISTS.probOf[s] = probs[s];
    });
  }

  function restoreCustom() {
    loadCustom().forEach(s => applySupplier(s.name, s.stages, s.probs, s.groups));
  }

  function rebuildTabs() {
    const box = document.getElementById("nccTabs");
    if (!box || typeof LISTS === "undefined") return;
    box.innerHTML = LISTS.nccs.map(n =>
      '<button class="ncc-tab' + (n === (typeof nccFilter !== "undefined" ? nccFilter : "") ? " on" : "") +
      '" data-ncc="' + esc(n) + '" onclick="setNcc(\'' + esc(n).replace(/'/g, "\\'") + '\')">' + esc(n) + '</button>').join("");
    addSupplierButton();
  }

  function addSupplierButton() {
    const box = document.getElementById("nccTabs");
    if (!box || document.getElementById("btnAddNcc")) return;
    const b = document.createElement("button");
    b.id = "btnAddNcc"; b.type = "button"; b.className = "ncc-add";
    b.title = "Thêm nhà cung cấp"; b.setAttribute("aria-label", "Thêm nhà cung cấp");
    b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
    b.onclick = openSupplierModal;
    box.parentNode.insertBefore(b, box.nextSibling);
  }

  function openSupplierModal() {
    let ov = document.getElementById("nccOv");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "nccOv"; ov.className = "x-ov";
      ov.innerHTML = '<div class="x-modal glass" role="dialog" aria-modal="true" aria-labelledby="nccT">' +
        '<div class="x-head"><h3 id="nccT">Thêm nhà cung cấp</h3>' +
        '<button class="x-close" id="nccX" type="button" aria-label="Đóng">×</button></div>' +
        '<div class="x-body" id="nccBody"></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener("click", e => { if (e.target === ov) ov.classList.remove("open"); });
      document.getElementById("nccX").onclick = () => ov.classList.remove("open");
    }
    ov.classList.add("open");

    const existing = (typeof LISTS !== "undefined" ? LISTS.nccs : []).slice();
    const body = document.getElementById("nccBody");
    body.innerHTML =
      '<label class="x-f"><span>Tên nhà cung cấp</span>' +
        '<input id="nccName" autocomplete="off" spellcheck="false"></label>' +
      '<div class="x-sec-h">Chọn mô hình pipeline để áp dụng</div>' +
      '<div class="ncc-tpls" id="nccTpls">' +
        existing.map((n, i) => {
          const st = (LISTS.pipelines[n] || []);
          return '<button type="button" class="ncc-tpl" data-src="' + esc(n) + '" ' +
            'style="--tc:' + colorOf(n, i) + '">' +
            '<span class="tpl-head"><b>' + esc(n) + '</b><small>' + st.length + ' giai đoạn</small></span>' +
            '<span class="tpl-stages">' + st.map((s, j) =>
              '<span class="tpl-stage"><i>' + (j + 1) + '</i>' + esc(s) + '</span>').join("") +
            '</span></button>';
        }).join("") +
      '</div>' +
      '<p class="x-msg" id="nccMsg" role="alert" aria-live="polite"></p>' +
      '<div class="x-actions">' +
        '<button type="button" class="x-btn ghost" id="nccCancel">Huỷ</button>' +
        '<button type="button" class="x-btn primary" id="nccSave">Thêm nhà cung cấp</button>' +
      '</div>';

    let picked = existing[0] || "";
    const paint = () => body.querySelectorAll(".ncc-tpl").forEach(t =>
      t.classList.toggle("on", t.dataset.src === picked));
    body.querySelectorAll(".ncc-tpl").forEach(t => t.onclick = () => { picked = t.dataset.src; paint(); });
    paint();
    document.getElementById("nccCancel").onclick = () => ov.classList.remove("open");
    document.getElementById("nccSave").onclick = () => {
      const msg = document.getElementById("nccMsg");
      const name = (document.getElementById("nccName").value || "").trim();
      if (!name) { msg.textContent = "Nhập tên nhà cung cấp."; msg.className = "x-msg err"; return; }
      if (LISTS.nccs.some(n => n.toLowerCase() === name.toLowerCase())) {
        msg.textContent = "Nhà cung cấp này đã có."; msg.className = "x-msg err"; return;
      }
      if (!picked) { msg.textContent = "Chọn một mô hình pipeline."; msg.className = "x-msg err"; return; }
      const stages = (LISTS.pipelines[picked] || []).slice();
      const probs = {}, groups = {};
      stages.forEach(s => { probs[s] = LISTS.probOf[s]; groups[s] = LISTS.groupOf[s]; });
      applySupplier(name, stages, probs, groups);
      const arr = loadCustom(); arr.push({ name, stages, probs, groups, from: picked }); saveCustom(arr);
      rebuildTabs();
      if (window.setNcc) setNcc(name);
      if (window.buildForm) try { buildForm(); } catch (e) {}
      ov.classList.remove("open");
      if (window.toast) toast('Đã thêm "' + name + '" theo mô hình ' + picked + ".");
    };
  }

  /* ================= 2. CHI TIẾT KHÁCH HÀNG TỪ HOẠT ĐỘNG ================= */
  function customerModal(cust) {
    let ov = document.getElementById("custOv");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "custOv"; ov.className = "x-ov";
      ov.innerHTML = '<div class="x-modal wide glass" role="dialog" aria-modal="true" aria-labelledby="custT">' +
        '<div class="x-head"><h3 id="custT"></h3>' +
        '<button class="x-close" id="custX" type="button" aria-label="Đóng">×</button></div>' +
        '<div class="x-body" id="custBody"></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener("click", e => { if (e.target === ov) ov.classList.remove("open"); });
      document.getElementById("custX").onclick = () => ov.classList.remove("open");
    }
    ov.classList.add("open");

    const prj = (typeof RECORDS !== "undefined" ? RECORDS : []).filter(r => r.customer === cust);
    const acts = (typeof ACTIVITIES !== "undefined" ? ACTIVITIES : []).filter(a => a.customer === cust);
    const run = prj.filter(r => r.status === "IN PROGRESS").length;
    const won = prj.filter(r => r.status === "WON").length;
    const lost = prj.filter(r => r.status === "LOST").length;
    const kg = prj.reduce((s, r) => s + (r.kgThis || 0), 0);
    const nccs = [...new Set(prj.map(r => r.ncc).concat(acts.map(a => a.ncc)).filter(Boolean))];

    document.getElementById("custT").innerHTML = esc(cust) +
      '<span class="cust-chips">' + nccs.map((n, i) =>
        '<span class="cust-chip" style="--c:' + colorOf(n, i) + '">' + esc(n) + "</span>").join("") + "</span>";

    document.getElementById("custBody").innerHTML =
      '<div class="cust-kpis">' +
        '<div class="cust-kpi"><b>' + prj.length + "</b><span>dự án</span></div>" +
        '<div class="cust-kpi run"><b>' + run + "</b><span>đang chạy</span></div>" +
        '<div class="cust-kpi won"><b>' + won + "</b><span>thắng</span></div>" +
        '<div class="cust-kpi lost"><b>' + lost + "</b><span>thua</span></div>" +
        '<div class="cust-kpi"><b>' + fmtN(kg) + "</b><span>KG 2026</span></div>" +
      "</div>" +
      '<div class="x-sec-h">Dự án của khách hàng</div>' +
      (prj.length
        ? '<div class="cust-tbl"><table><thead><tr><th>Mã</th><th>Sản phẩm</th><th>Giai đoạn</th>' +
          "<th>Trạng thái</th><th>KG</th><th>PIC</th></tr></thead><tbody>" +
          prj.map(r => '<tr data-open="' + esc(r.id) + '"><td><b>' + esc(r.id) + "</b></td><td>" +
            esc(r.product) + "</td><td>" + esc(r.stage) + '</td><td><span class="st st-' +
            (r.status === "WON" ? "won" : r.status === "LOST" ? "lost" : "run") + '">' +
            esc(r.status) + "</span></td><td>" + fmtN(r.kgThis) + "</td><td>" + esc(r.pic) + "</td></tr>").join("") +
          "</tbody></table></div>"
        : '<div class="x-empty">Chưa có dự án nào.</div>') +
      '<div class="x-sec-h">Lịch sử hoạt động (' + acts.length + ")</div>" +
      (acts.length
        ? '<ol class="cust-tl">' + acts.slice()
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
            .map(a => '<li><span class="tl-d">' + viDay(a.date) + '</span><span class="tl-b">' +
              '<b>' + esc(a.type) + "</b> · " + esc(a.pic || "—") +
              '<span class="tl-note">' + esc(a.note) + "</span>" +
              (a.next ? '<span class="tl-next">→ ' + esc(a.next) + "</span>" : "") +
              "</span></li>").join("") + "</ol>"
        : '<div class="x-empty">Chưa có hoạt động nào.</div>');

    document.getElementById("custBody").querySelectorAll("[data-open]").forEach(tr => {
      tr.onclick = () => {
        ov.classList.remove("open");
        if (window.openDetail) openDetail(tr.dataset.open);
      };
    });
  }

  function wireActivityClicks() {
    const box = document.getElementById("actRows");
    if (!box || box.dataset.custReady) return;
    box.dataset.custReady = "1";
    box.addEventListener("click", e => {
      if (e.target.closest("button")) return;              // nút Tạo dự án / mở dự án giữ nguyên
      const row = e.target.closest(".act-row");
      if (!row) return;
      const name = (row.querySelector("b") || {}).textContent;
      if (name) customerModal(name.trim());
    });
    box.classList.add("act-clickable");
  }

  /* ================= 3. BIỂU ĐỒ TỶ TRỌNG SEGMENT ================= */
  function segCard() {
    const grid = document.querySelector("#view-dash .dash-grid");
    if (!grid || document.getElementById("segShareBox")) return;
    const card = document.createElement("div");
    card.className = "card glass";
    card.innerHTML = '<h4>Tỷ trọng Segment</h4>' +
      '<div id="segShareBox"></div><div class="legend" id="segShareLeg"></div>';
    const segCardEl = [...grid.children].find(c => /Phân khúc thị trường/.test(c.textContent));
    if (segCardEl && segCardEl.nextSibling) grid.insertBefore(card, segCardEl.nextSibling);
    else grid.appendChild(card);
  }

  function renderSegShare() {
    segCard();
    if (!document.getElementById("segShareBox") || !window.donut) return;
    const data = (typeof visible === "function" ? visible() : RECORDS) || [];
    const by = {};
    data.forEach(r => { if (r.segment) by[r.segment] = (by[r.segment] || 0) + 1; });
    const pal = (typeof SEG_COLORS !== "undefined" && SEG_COLORS) || ["#0B4F9E"];
    const items = Object.keys(by).sort((a, b) => by[b] - by[a])
      .map((s, i) => ({ label: s, value: by[s], color: pal[i % pal.length] }));
    if (!items.length) {
      document.getElementById("segShareBox").innerHTML = '<div class="x-empty">Chưa có dữ liệu segment.</div>';
      document.getElementById("segShareLeg").innerHTML = ""; return;
    }
    try {
      donut("segShareBox", "segShareLeg", items, lbl => {
        if (typeof segDrill !== "undefined") { /* để nguyên bộ lọc hiện tại */ }
        if (window.toast) toast(lbl + ": " + by[lbl] + " dự án");
      });
    } catch (e) { console.warn("[extras] segment chart:", e.message); }
  }

  /* ================= gắn vào vòng đời ================= */
  function wrap(name, fn) {
    const o = window[name];
    if (typeof o !== "function") return;
    window[name] = function () { const r = o.apply(this, arguments); try { fn(); } catch (e) {} return r; };
  }
  const safe = f => { try { f(); } catch (e) { console.warn("[extras]", e && e.message); } };

  function boot() {
    safe(restoreCustom);
    wrap("loginAs", () => setTimeout(() => {
      safe(rebuildTabs); safe(addSupplierButton); safe(wireActivityClicks);
    }, 90));
    wrap("renderActs", () => safe(wireActivityClicks));
    wrap("renderDash", () => safe(renderSegShare));
    wrap("go", () => { safe(addSupplierButton); safe(wireActivityClicks); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.FISG_EXTRAS = { openSupplierModal, customerModal, renderSegShare, applySupplier };
})();
