/* js/funnel-ui.js — Bảng Sales Funnel (nạp CUỐI).
 * 1) Xuất Excel chuyển vào menu hồ sơ (kèm Đăng xuất)   3) Hover card + thanh trượt %
 * 2) Nút "Thêm dự án" dạt phải                          4) Hai phím trạng thái dựng đứng bên trái
 */
(function () {
  "use strict";

  const KEYS = [
    { id: "run",    label: "Đang chạy", match: /ĐANG CHẠY|IN PROGRESS/i,
      color: "#1E3A8A", soft: "#EEF2FB", bd: "#C9D5F0", sub: "theo mốc thời gian" },
    { id: "closed", label: "Đã đóng",   match: /ĐÃ ĐÓNG|CLOSED/i,
      color: "#565668", soft: "#F1F1F5", bd: "#D8D8E2", sub: "thắng · thua" },
  ];
  let active = "run";
  try { active = localStorage.getItem("fisg_funnel_key") || "run"; } catch (e) {}

  /* ---------- 1. Xuất Excel (CSV thật) trong menu hồ sơ ---------- */
  function rows() {
    if (typeof window.visible === "function") { try { return visible(); } catch (e) {} }
    return (typeof RECORDS !== "undefined" && RECORDS) || [];
  }
  function csvCell(v) {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportExcel() {
    const data = rows();
    if (!data.length) { if (window.toast) toast("Không có dự án nào để xuất."); return; }
    const head = ["Mã dự án", "Nhà cung cấp", "Khách hàng", "Sản phẩm", "Ứng dụng", "Nhóm ngành",
      "Segment", "Giai đoạn", "Trạng thái", "% dự án", "KG năm nay", "KG năm sau",
      "Sale phụ trách", "Ngày tạo", "Ngày đóng dự kiến"];
    const body = data.map(r => [r.id, r.ncc, r.customer, r.product, r.application, r.group,
      r.segment, r.stage, r.status, Math.round((r.prob || 0) * 100),
      r.kgThis || 0, r.kgNext || 0, r.pic, r.created, r.closing]);
    const csv = "﻿" + [head, ...body].map(l => l.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    const d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = "FISG_SalesFunnel_" + d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + ".csv";
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    if (window.toast) toast("Đã xuất " + data.length + " dự án ra Excel.");
  }

  function moveExportToProfile() {
    const menu = document.querySelector(".profile-menu");
    if (!menu || menu.querySelector("#pmExport")) return;
    const out = menu.querySelector("#pmOut");
    const b = document.createElement("button");
    b.id = "pmExport"; b.type = "button"; b.className = "profile-act neutral"; b.setAttribute("role", "menuitem");
    b.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>' +
      'Xuất Excel';
    b.onclick = () => {
      exportExcel();
      const w = document.querySelector(".profile-wrap");
      if (w) w.classList.remove("open");
    };
    if (out) out.parentNode.insertBefore(b, out); else menu.appendChild(b);
    // gỡ nút cũ trên thanh công cụ
    document.querySelectorAll('#view-funnel .topbar button').forEach(x => {
      if (/Xuất Excel/i.test(x.textContent)) x.remove();
    });
  }

  /* ---------- 4. Hai phím trạng thái bên trái ---------- */
  function buildRail() {
    const view = document.getElementById("view-funnel");
    const groups = document.getElementById("groups");
    if (!view || !groups || document.getElementById("fnRail")) return;

    const wrap = document.createElement("div");
    wrap.className = "fn-wrap";
    const rail = document.createElement("div");
    rail.id = "fnRail"; rail.className = "fn-rail";
    rail.setAttribute("role", "tablist");
    rail.setAttribute("aria-label", "Trạng thái dự án");
    rail.innerHTML = KEYS.map(k =>
      '<button type="button" class="fn-key" role="tab" data-key="' + k.id + '" ' +
        'aria-selected="false" style="--key:' + k.color + ';--key-soft:' + k.soft + ';--key-bd:' + k.bd + '">' +
        '<span class="fn-key-label">' + k.label + '</span>' +
        '<span class="fn-key-num" data-num="' + k.id + '">—</span>' +
        '<span class="fn-key-sub">' + k.sub + '</span>' +
      '</button>').join("");

    groups.parentNode.insertBefore(wrap, groups);
    wrap.appendChild(rail);
    wrap.appendChild(groups);

    rail.querySelectorAll(".fn-key").forEach(b => {
      b.onclick = () => setKey(b.dataset.key);
      b.addEventListener("keydown", e => {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); setKey("closed"); rail.querySelector('[data-key="closed"]').focus(); }
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); setKey("run"); rail.querySelector('[data-key="run"]').focus(); }
      });
    });
  }

  function setKey(id) {
    active = id;
    try { localStorage.setItem("fisg_funnel_key", id); } catch (e) {}
    applyKey();
  }

  function majorFor(id) {
    const k = KEYS.find(x => x.id === id);
    return [...document.querySelectorAll("#groups .major")].find(m => {
      const t = (m.querySelector(".m-title") || {}).textContent || "";
      return k.match.test(t);
    });
  }

  function applyKey() {
    const rail = document.getElementById("fnRail");
    if (!rail) return;
    rail.querySelectorAll(".fn-key").forEach(b => {
      const on = b.dataset.key === active;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    // đếm số dự án mỗi trạng thái
    const data = rows();
    const nRun = data.filter(r => r.status === "IN PROGRESS").length;
    const nClosed = data.length - nRun;
    const setNum = (id, v) => {
      const el = rail.querySelector('[data-num="' + id + '"]');
      if (el) el.textContent = v;
    };
    setNum("run", nRun); setNum("closed", nClosed);

    // chỉ hiện đúng khối trạng thái đang chọn
    const majors = [...document.querySelectorAll("#groups .major")];
    if (!majors.length) return;
    let shown = 0;
    KEYS.forEach(k => {
      const m = majorFor(k.id);
      if (!m) return;
      const on = k.id === active;
      m.style.display = on ? "" : "none";
      if (on) {
        shown++;
        m.classList.remove("collapsed");                       // mở sẵn để thấy các cấp bên trong
        if (typeof collapsed !== "undefined") collapsed["major-" + (k.id === "run" ? "run" : "closed")] = false;
      }
    });
    // trạng thái rỗng: vẫn hiện khối "không có dự án"
    if (!shown) majors.forEach(m => { m.style.display = ""; });
  }

  /* ---------- 3. Thanh trượt % (oninput cập nhật ngay) ---------- */
  function slider(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel || sel.dataset.sliderReady) return;
    sel.dataset.sliderReady = "1";
    const wrap = document.createElement("div");
    wrap.className = "pb-wrap";
    const cur = parseInt(sel.value, 10) || 10;
    wrap.innerHTML =
      '<input type="range" class="pb-range" min="0" max="100" step="5" value="' + cur + '" ' +
        'aria-label="% dự án">' +
      '<span class="pb-val">' + cur + '%</span>';
    sel.parentNode.insertBefore(wrap, sel);
    sel.classList.add("pb-hidden");
    const range = wrap.querySelector(".pb-range"), out = wrap.querySelector(".pb-val");

    const pushToSelect = v => {
      // chọn mốc gần nhất có trong danh sách gốc để dữ liệu vẫn hợp lệ
      const opts = [...sel.options].map(o => parseInt(o.value || o.textContent, 10)).filter(n => !isNaN(n));
      if (!opts.length) return;
      const near = opts.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, opts[0]);
      sel.value = [...sel.options].find(o => parseInt(o.value || o.textContent, 10) === near).value;
    };
    range.addEventListener("input", () => {           // cập nhật ngay khi kéo
      out.textContent = range.value + "%";
      pushToSelect(+range.value);
    });
    range.addEventListener("change", () => sel.dispatchEvent(new Event("change", { bubbles: true })));
    // đồng bộ ngược khi code khác đổi select (vd đổi giai đoạn)
    const sync = () => {
      const v = parseInt(sel.value, 10);
      if (!isNaN(v)) { range.value = v; out.textContent = v + "%"; }
      range.disabled = sel.disabled;
    };
    sel.addEventListener("change", sync);
    new MutationObserver(sync).observe(sel, { attributes: true, childList: true });
    sync();
  }

  function probPopSlider() {
    const pop = document.getElementById("probPop");
    const chips = document.getElementById("ppChips");
    if (!pop || !chips || pop.querySelector(".pb-range")) return;
    const cur = parseInt((chips.querySelector(".pp-chip.on") || {}).textContent, 10) || 50;
    const w = document.createElement("div");
    w.className = "pb-wrap";
    w.innerHTML = '<input type="range" class="pb-range" min="0" max="100" step="5" value="' + cur + '" aria-label="% dự án">' +
                  '<span class="pb-val">' + cur + '%</span>';
    chips.style.display = "none";
    chips.parentNode.appendChild(w);
    const range = w.querySelector(".pb-range"), out = w.querySelector(".pb-val");
    range.addEventListener("input", () => { out.textContent = range.value + "%"; });
    range.addEventListener("change", () => { if (window.setProb) setProb(+range.value); });
  }

  /* ---------- gắn vào vòng đời ---------- */
  function afterRender() { applyKey(); }
  function wrap(name, fn) {
    const o = window[name];
    if (typeof o !== "function") return;
    window[name] = function () { const r = o.apply(this, arguments); try { fn(); } catch (e) {} return r; };
  }

  function boot() {
    const safe = f => { try { f(); } catch (e) { console.warn("[funnel-ui]", e && e.message); } };
    wrap("loginAs", () => setTimeout(() => {
      safe(buildRail); safe(moveExportToProfile); safe(applyKey);
      safe(() => slider("f-prob")); safe(() => slider("d-prob"));
    }, 80));
    wrap("render", afterRender);
    wrap("go", () => { safe(buildRail); safe(applyKey); safe(moveExportToProfile); });
    wrap("buildForm", () => safe(() => slider("f-prob")));
    wrap("openForm", () => safe(() => slider("f-prob")));
    wrap("openDetail", () => setTimeout(() => safe(() => slider("d-prob")), 30));
    wrap("openProbPop", () => setTimeout(() => safe(probPopSlider), 20));
    safe(buildRail); safe(moveExportToProfile);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.FISG_FUNNEL_UI = { exportExcel, setKey, applyKey };
})();
